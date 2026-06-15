#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(__dirname, '..');

const ALLOWED_OLD_FIELD_FILES = new Set([
  join(rootDir, 'packages/data-provider/src/file-metadata/normalize.ts'),
  join(rootDir, 'packages/data-provider/src/file-metadata/types.ts'),
  join(rootDir, 'packages/data-provider/src/types/files.ts'),
]);

const ALLOWED_TYPES_FILES_IMPORTS = new Set([
  join(rootDir, 'packages/data-provider/src/types/assistants.ts'),
  join(rootDir, 'packages/data-provider/src/types/index.ts'),
  join(rootDir, 'packages/data-provider/src/types/files.ts'),
]);

const SCAN_DIRS = [
  join(rootDir, 'api'),
  join(rootDir, 'client'),
  join(rootDir, 'packages'),
];

const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.next',
  '.turbo',
  'e2e',
];

const EXCLUDE_EXTENSIONS = ['.json', '.md', '.yaml', '.yml', '.env', '.sh'];

const EXCLUDE_FILE_PATTERNS = [
  /\.spec\.(ts|js|tsx|jsx)$/,
  /\.test\.(ts|js|tsx|jsx)$/,
  /\/__tests__\//,
];

const FILE_VAR_PREFIXES = [
  'file', 'files',
  'attachment', 'attachments',
  'batchFile', 'batchFiles',
  'imageFile', 'imageFiles',
  'fileData', 'fileDatas',
  'extendedFile', 'extendedFiles',
  'TFile', 'UnifiedFileLike',
  'img$',
];

const EXCLUDED_VAR_CONTEXTS = [
  'feedback',
  'txn',
  'document',
  'msg',
  'message',
  'part',
  'content',
];

const buildFileAccessPattern = () => {
  const varPattern = FILE_VAR_PREFIXES.join('|');
  return new RegExp(
    `(?:^|[^a-zA-Z0-9_$.])(${varPattern})(?:\\.([a-zA-Z_$][a-zA-Z0-9_$]*)|\\[['"]([^'"]+)['"]\\])`,
    'g'
  );
};

const OLD_FIELDS = new Set([
  'embedded',
  'context',
  'width',
  'height',
  'text',
  'textFormat',
]);

const TYPES_FILES_IMPORT_PATTERN = /from\s+['"][^'"]*types\/files['"]/g;

const FIELD_NAME_MAP = {
  '.embedded': 'embedded',
  '.context': 'context',
  '.width': 'width',
  '.height': 'height',
  '.text': 'text',
  '.textFormat': 'textFormat',
};

function isInExcludeDir(filePath) {
  const relPath = relative(rootDir, filePath);
  return EXCLUDE_DIRS.some((dir) => relPath.includes(`/${dir}/`) || relPath.startsWith(`${dir}/`));
}

function isExcludedFile(filePath) {
  const fileName = basename(filePath);
  return EXCLUDE_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (isInExcludeDir(filePath)) continue;
    if (isExcludedFile(filePath)) continue;

    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile()) {
      const ext = extname(filePath);
      if (EXCLUDE_EXTENSIONS.includes(ext)) continue;
      if (!['.js', '.ts', '.jsx', '.tsx'].includes(ext)) continue;
      callback(filePath);
    }
  }
}

function stripCommentsAndStrings(content) {
  let result = '';
  let i = 0;
  const n = content.length;

  while (i < n) {
    if (i + 1 < n && content[i] === '/' && content[i + 1] === '/') {
      while (i < n && content[i] !== '\n') {
        result += content[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }

    if (i + 1 < n && content[i] === '/' && content[i + 1] === '*') {
      result += '  ';
      i += 2;
      while (i + 1 < n && !(content[i] === '*' && content[i + 1] === '/')) {
        result += content[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i + 1 < n) {
        result += '  ';
        i += 2;
      }
      continue;
    }

    if (content[i] === "'" || content[i] === '"' || content[i] === '`') {
      const quote = content[i];
      result += ' ';
      i++;
      while (i < n && content[i] !== quote) {
        if (content[i] === '\\' && i + 1 < n) {
          result += '  ';
          i += 2;
          continue;
        }
        result += content[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        result += ' ';
        i++;
      }
      continue;
    }

    result += content[i];
    i++;
  }

  return result;
}

function scanFile(filePath) {
  const relPath = relative(rootDir, filePath);
  const violations = [];

  if (ALLOWED_OLD_FIELD_FILES.has(filePath)) {
    return violations;
  }

  if (ALLOWED_TYPES_FILES_IMPORTS.has(filePath)) {
    return violations;
  }

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (err) {
    return [{ line: 0, message: `Failed to read file: ${err.message}` }];
  }

  const strippedContent = stripCommentsAndStrings(content);
  const lines = content.split('\n');
  const strippedLines = strippedContent.split('\n');
  const accessPattern = buildFileAccessPattern();

  for (let lineNum = 0; lineNum < strippedLines.length; lineNum++) {
    const strippedLine = strippedLines[lineNum];
    const originalLine = lines[lineNum];

    if (strippedLine.includes('checkOpenAIStorage')) {
      continue;
    }
    if (strippedLine.includes('Embedded') && !strippedLine.includes('.embedded')) {
      continue;
    }

    accessPattern.lastIndex = 0;
    let match;
    while ((match = accessPattern.exec(strippedLine)) !== null) {
      const varName = match[1];
      const fieldName = match[2] || match[3];

      if (EXCLUDED_VAR_CONTEXTS.includes(varName)) {
        continue;
      }

      if (!OLD_FIELDS.has(fieldName)) {
        continue;
      }

      if (fieldName === 'text' && strippedLine.includes('.text(')) {
        continue;
      }
      if (fieldName === 'context' && strippedLine.includes('.context(')) {
        continue;
      }

      violations.push({
        file: relPath,
        line: lineNum + 1,
        column: match.index + match[1].length + 2,
        message: `禁止直接访问旧字段 \`${varName}.${fieldName}\`。请通过 file-metadata 域模块的 normalize/serialize 或语义函数（isIndexed/getDisplayWidth/getDisplayText 等）间接访问。`,
        code: originalLine.trim(),
      });
    }

    TYPES_FILES_IMPORT_PATTERN.lastIndex = 0;
    let importMatch;
    while ((importMatch = TYPES_FILES_IMPORT_PATTERN.exec(strippedLine)) !== null) {
      violations.push({
        file: relPath,
        line: lineNum + 1,
        column: importMatch.index + 1,
        message: `禁止从 types/files 路径导入。请从 file-metadata 域模块或 librechat-data-provider 统一入口导入。`,
        code: originalLine.trim(),
      });
    }
  }

  return violations;
}

function main() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 文件元数据边界扫描');
  console.log('='.repeat(80));
  console.log(`扫描目录: ${SCAN_DIRS.map((d) => relative(rootDir, d)).join(', ')}`);
  console.log(`允许的旧字段文件: ${[...ALLOWED_OLD_FIELD_FILES].map((f) => relative(rootDir, f)).join(', ')}`);
  console.log(`允许的 types/files 导入: ${[...ALLOWED_TYPES_FILES_IMPORTS].map((f) => relative(rootDir, f)).join(', ')}`);
  console.log(`检测字段: ${[...OLD_FIELDS].join(', ')}`);
  console.log('='.repeat(80) + '\n');

  const allViolations = [];

  for (const scanDir of SCAN_DIRS) {
    if (!existsSync(scanDir)) continue;
    walkDir(scanDir, (filePath) => {
      const violations = scanFile(filePath);
      if (violations.length > 0) {
        allViolations.push(...violations);
      }
    });
  }

  if (allViolations.length === 0) {
    console.log('✅ 扫描完成，未发现违规！');
    console.log('\n' + '='.repeat(80) + '\n');
    process.exit(0);
  } else {
    console.log(`❌ 发现 ${allViolations.length} 处违规：\n`);

    let currentFile = null;
    for (const v of allViolations) {
      if (v.file !== currentFile) {
        currentFile = v.file;
        console.log(`\n📁 ${v.file}`);
      }
      console.log(`   第 ${v.line} 行${v.column ? `, 第 ${v.column} 列` : ''}:`);
      console.log(`      ❌ ${v.message}`);
      console.log(`      代码: ${v.code}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`总计: ${allViolations.length} 处违规`);
    console.log('='.repeat(80) + '\n');
    process.exit(1);
  }
}

main();
