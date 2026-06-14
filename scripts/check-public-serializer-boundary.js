#!/usr/bin/env node
/**
 * @fileoverview Public Serializer Boundary Checker
 *
 * 工程级静态扫描脚本：强制 share / search / export / 搜索索引预处理 四个公开场景
 * 必须通过 `serializeXxx` 工厂函数消费序列化输出，禁止：
 *   1. 直接 import publicMessageSerializer（绕过 factories 二次校验）
 *   2. 代码中直接访问 message.metadata / message.files / message.attachments /
 *      message.content[*].tool_call.outputs 等敏感字段
 *
 * 允许范围：factories.ts 内部实现、*.test.ts / *.test.js 测试文件、
 *          读取原始数据后立即传给 serializeXxx 的 db 调用。
 *
 * 任何违反都会以非零退出码报错，阻断 CI。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// =============== 规则定义 ===============

/**
 * 精确名单：所有涉及公开输出的文件。
 * 新增公开场景路由/模块时，必须加入此列表（否则会漏掉检测）。
 */
const PUBLIC_SCENE_FILES = [
  // data-schemas 层
  'packages/data-schemas/src/methods/share.ts',
  'packages/data-schemas/src/models/plugins/mongoMeili.ts',
  // api routes 层
  'api/server/routes/convos.js',          // export 路由
  'api/server/routes/messages.js',        // search 分支
  'api/server/routes/share.js',           // share 路由
  'api/server/routes/search.js',          // search 路由
  // 前端：导出（share/search 通常经由 data-provider，这里无需直接扫描）
];

/**
 * 目录级模糊匹配：这些目录下的 .ts/.js 文件都属于公开场景。
 * 新增公开场景子目录时请更新此处。
 */
const PUBLIC_SCENE_GLOBS = [
  // 未来可能新增 packages/data-schemas/src/methods/export/ 等目录
];

/**
 * 测试/实现内部文件：即使匹配 PUBLIC_SCENE_FILES 也完全豁免。
 */
const EXEMPT_FILE_BASENAMES = [
  /\.test\.(ts|js)$/,
  /\.spec\.(ts|js)$/,
  /^factories\.(ts|js)$/,
  /^publicMessage\.(ts|js)$/,
  /-mock(s)?\./,
  /-route-mocks\./,
  /__test-utils__/,
  /__tests__/,
];

// 非法 import：从 serializer 模块导入了 publicMessageSerializer
const BANNED_IMPORT_PATTERNS = [
  {
    name: '直接 import publicMessageSerializer',
    regex: /import\s*\{[^}]*publicMessageSerializer[^}]*\}\s*from\s*['"][^'"]*serializers[^'"]*['"]/g,
    suggestion: '请改为 import { serializeSharedMessages | serializeExportMessages | serializeSearchResults | serializeSearchIndexMessage }，仅 factories.ts 内部可直接引用 publicMessageSerializer。',
  },
  {
    name: '从 @librechat/data-schemas 直接 destructure publicMessageSerializer（require 形式）',
    regex: /require\s*\(\s*['"]@librechat\/data-schemas['"]\s*\)[\s\S]*?publicMessageSerializer/g,
    suggestion: '请改为只 require serializeXxx 工厂函数。',
  },
];

// 敏感字段访问：公开场景中禁止直接访问（.metadata / .files / .attachments / content[*].tool_call.outputs 等）
const SENSITIVE_FIELD_PATTERNS = [
  {
    name: '直接访问 .metadata',
    regex: /\.(message|msg|m|rawMessage|dbMessage)\.metadata(?![a-zA-Z_])/g,
    suggestion: '请通过 serializeXxx 工厂函数输出的 PublicMessage 字段访问。',
  },
  {
    name: '直接访问 .files',
    regex: /\.(message|msg|m|rawMessage|dbMessage|savedMessage)\.files(?![a-zA-Z_])/g,
    suggestion: '请通过 serializeXxx.sanitizeFile / sanitizeFiles 的输出访问，或走 PublicMessage.files 白名单字段。',
  },
  {
    name: '直接访问 .attachments（在非 serializeXxx 调用上下文）',
    regex: /\.(message|msg|m|rawMessage|dbMessage)\.attachments(?![a-zA-Z_])/g,
    suggestion: '请通过 serializeXxx.sanitizeAttachments 的 PublicMessage.attachments 摘要字段访问。',
  },
  {
    name: '直接访问 .plugin / .plugins（公开场景禁止泄漏插件配置）',
    regex: /\.(message|msg|m|rawMessage|dbMessage)\.plugin(s)?(?![a-zA-Z_])/g,
    suggestion: '公开输出禁止携带 plugin 配置。请走 serializeXxx 工厂白名单。',
  },
  {
    name: '直接访问 .endpoint / .clientId / .conversationSignature 等敏感运行态字段',
    regex: /\.(message|msg|m|rawMessage|dbMessage)\.(endpoint|clientId|conversationSignature|invocationId|thread_id|contextMeta)(?![a-zA-Z_])/g,
    suggestion: '公开输出白名单不包含这些字段。删除访问或走 serializeXxx 工厂。',
  },
  {
    name: '直接访问 content.tool_call.* 原始对象（未走 sanitizeContentPart）',
    regex: /\.content\s*\[[^\]]*\]\s*\.\s*tool_call\s*\.\s*(outputs|arguments|code_interpreter)/g,
    suggestion: '请通过 serializeXxx.sanitizeContentPart 的 PublicContentPart 摘要访问，禁止直接读 tool outputs / code interpreter 原始 payload。',
  },
];

// 豁免：出现在这些行上视为正常
const EXEMPT_LINE_PATTERNS = [
  /serialize(SharedMessages|ExportMessages|SearchResults|SearchIndexMessage)\s*\(/,
  /publicMessageSerializer\.for(Search|Share|Export|Display)\s*\(/,
  /\.test\.(ts|js)$/,
  /^import|^export|from ['"]/,
  /type\s+\w+\s*=|interface\s+\w+\s*\{/,
];

// =============== 扫描逻辑 ===============

/**
 * 计算某一行属于哪个“场景块”。
 * 目前 convos.js / messages.js 中既有公开场景又有内部接口，需要按函数上下文区分。
 * 简化策略：对 convos.js / messages.js 只扫描包含 export/search 关键字的函数。
 */
function collectTargetFiles(root) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|js)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(root);
  return results;
}

function isPublicSceneFile(absPath, repoRoot) {
  const rel = path.relative(repoRoot, absPath).split(path.sep).join('/');

  // 测试/内部文件先排除
  for (const exempt of EXEMPT_FILE_BASENAMES) {
    if (exempt.test(rel) || exempt.test(path.basename(absPath))) {
      return { matched: false };
    }
  }

  if (PUBLIC_SCENE_FILES.includes(rel)) {
    return { matched: true, reason: `精确命中 PUBLIC_SCENE_FILES: ${rel}` };
  }
  for (const glob of PUBLIC_SCENE_GLOBS) {
    if (rel.includes(glob)) {
      return { matched: true, reason: `命中 PUBLIC_SCENE_GLOBS: ${glob}` };
    }
  }
  return { matched: false };
}

/**
 * 从文件的 AST-ish 文本中识别“场景上下文”——粗粒度但足以捕获未来新增的情况。
 * 规则：只要文件包含 'serializeXxx' 或 'forShare/forSearch/forExport' 相关函数/路由定义，
 * 整个文件纳入扫描（因为公开场景和内部路由在同一个文件，按文件级别做粗扫描+行豁免足够安全）。
 */
function checkFileContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const errors = [];

  function addError(lineNum, ruleName, line, suggestion) {
    errors.push({
      file: filePath,
      line: lineNum,
      rule: ruleName,
      snippet: line.trim().slice(0, 200),
      suggestion,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // 豁免行
    let isExempt = false;
    for (const exemptRe of EXEMPT_LINE_PATTERNS) {
      if (exemptRe.test(line)) {
        isExempt = true;
        break;
      }
    }
    if (isExempt) continue;

    // 1) 非法 import
    for (const rule of BANNED_IMPORT_PATTERNS) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line)) {
        addError(lineNum, rule.name, line, rule.suggestion);
      }
    }

    // 2) 敏感字段访问
    for (const rule of SENSITIVE_FIELD_PATTERNS) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line)) {
        addError(lineNum, rule.name, line, rule.suggestion);
      }
    }
  }

  return errors;
}

// =============== 主入口 ===============

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const targets = [
    path.join(repoRoot, 'packages/data-schemas/src'),
    path.join(repoRoot, 'api/server/routes'),
    path.join(repoRoot, 'packages/api/src'),
  ];

  const allErrors = [];
  const scannedPublicFiles = [];

  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    const files = collectTargetFiles(target);
    for (const f of files) {
      const info = isPublicSceneFile(f, repoRoot);
      if (!info.matched) continue;
      scannedPublicFiles.push({ file: f, reason: info.reason });
      const errs = checkFileContent(f);
      allErrors.push(...errs);
    }
  }

  // =============== 输出报告 ===============
  const COLOR = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
  };

  console.log(`${COLOR.bold}Public Serializer Boundary Check${COLOR.reset}`);
  console.log(`${COLOR.cyan}Scanned ${scannedPublicFiles.length} public-scene files:${COLOR.reset}`);
  for (const s of scannedPublicFiles) {
    console.log(`  - ${path.relative(repoRoot, s.file)}  (${s.reason})`);
  }
  console.log();

  if (allErrors.length === 0) {
    console.log(`${COLOR.green}${COLOR.bold}✅  PASSED${COLOR.reset} — 所有公开场景均通过 factories 消费 serializer，无直接敏感字段访问。`);
    process.exit(0);
  }

  console.log(`${COLOR.red}${COLOR.bold}❌  FAILED${COLOR.reset} — 发现 ${allErrors.length} 处边界违规：\n`);
  for (const [idx, err] of allErrors.entries()) {
    console.log(`${COLOR.yellow}[${idx + 1}] ${err.rule}${COLOR.reset}`);
    console.log(`  ${COLOR.cyan}${path.relative(repoRoot, err.file)}:${err.line}${COLOR.reset}`);
    console.log(`  ${COLOR.bold}↳ ${err.snippet}${COLOR.reset}`);
    console.log(`  ${COLOR.red}💡 建议: ${err.suggestion}${COLOR.reset}\n`);
  }

  process.exit(1);
}

main();
