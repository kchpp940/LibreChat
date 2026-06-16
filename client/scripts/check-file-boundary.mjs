#!/usr/bin/env node
/**
 * PublicFileAssetDescriptor boundary scanner.
 *
 * Scans client source code for accidental access to internal file fields
 * that should never be consumed by frontend display code.
 *
 * Internal fields that violate the display boundary:
 *   - filepath       (raw storage path — use `.url` from descriptor)
 *   - storageKey     (internal storage identifier — confidential)
 *   - storageRegion  (internal storage region — internal detail)
 *   - source         (internal storage origin — use `.filterSource`)
 *   - metadata       (raw internal metadata — not display-safe)
 *
 * Run with:  npm run check:file-boundary
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const SRC_DIR = new URL('../src/', import.meta.url).pathname;

// Internal file field patterns to flag
// Each entry has: pattern (regex), message, severity, context? (variable name pattern)
// Rules without `contextPattern` always match; rules with `contextPattern` only
// match when preceded by a variable name matching the context regex.
const FIELD_RULES = [
  {
    pattern: /\.storageKey\b/g,
    message:
      '`.storageKey` is an internal storage identifier and must never be accessed by client code. Use `file_id` or `url` from PublicFileAssetDescriptor instead.',
    severity: 'error',
  },
  {
    pattern: /\.storageRegion\b/g,
    message:
      '`.storageRegion` is an internal storage field and must never be accessed by client code.',
    severity: 'error',
  },
  {
    pattern: /\.filepath\b/g,
    message:
      '`.filepath` is an internal storage path — use `.url` from PublicFileAssetDescriptor which is the public download URL. Never expose raw storage paths in the client.',
    severity: 'error',
  },
  {
    pattern: /\.(?:source|metadata)\b/g,
    message:
      '`.source` and `.metadata` are internal file fields. For file objects, use `.filterSource` from PublicFileAssetDescriptor instead of `.source`, and access display-safe fields instead of raw `.metadata`. If this is not a file object, you can ignore this warning.',
    severity: 'warn',
    // Only flag when the preceding identifier looks like a file-related variable
    contextPattern: /(?:^|[\s(={,;])(?:file|files|attachment|attachments|f|uploadedFile|fileData|rawFile|fileRecord|agentFile|assistantFile|tempFile|fakeFile|fileObj|fileItem|fileEntry|fileDoc)\s*\.\s*$/i,
  },
];

// TS type cast patterns to flag
const CAST_RULES = [
  {
    pattern: /as\s+TFile\b/g,
    message:
      '`as TFile` casts bypass the PublicFileAssetDescriptor boundary. Frontend must only consume PublicFileAssetDescriptor — never cast back to the internal TFile type.',
    severity: 'error',
  },
  {
    pattern: /as\s+unknown\s+as\s+TFile\b/g,
    message:
      '`as unknown as TFile` deliberately bypasses type checks around the file display boundary. Use PublicFileAssetDescriptor instead.',
    severity: 'error',
  },
];

// All rules combined
const ALL_RULES = [...FIELD_RULES, ...CAST_RULES];

// File extensions to scan (TS/TSX are source of truth; JS/JSX are legacy/migrated)
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

// Paths to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '__tests__',
  'dist',
  'coverage',
]);

// Files that are allowed to access internal fields (boundary adapters).
// These files have explicit safety comments explaining why the access is
// necessary and are the ONLY places where .filepath / .preview may appear.
const BOUNDARY_ADAPTER_FILES = new Set([
  'utils/files.ts',          // getFileUrl / getFileThumbnailUrl adapters
  'utils/agents.tsx',        // getAgentAvatarUrl adapter
  'hooks/SSE/useContentHandler.ts', // SSE image_file → descriptor conversion
]);

function walkDir(dir, fileList = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(file)) continue;
      walkDir(fullPath, fileList);
    } else if (stat.isFile()) {
      if (SCAN_EXTENSIONS.has(extname(file))) {
        // Skip test files (but still scan them for TFile casts)
        const isTest =
          file.includes('.test.') ||
          file.includes('.spec.') ||
          fullPath.includes('/__tests__/');
        fileList.push({ path: fullPath, isTest });
      }
    }
  }
  return fileList;
}

function findViolations(filePath, isTest) {
  const content = readFileSync(filePath, 'utf-8');
  const violations = [];
  const lines = content.split('\n');

  for (const rule of ALL_RULES) {
    // For field rules in test files, only flag the most severe ones
    if (isTest && rule.severity !== 'error') continue;

    const regex = new RegExp(rule.pattern.source, 'g');
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Calculate line number
      let lineNumber = 1;
      let charCount = 0;
      for (let i = 0; i < match.index; i++) {
        if (content[i] === '\n') {
          lineNumber++;
          charCount = i + 1;
        }
      }
      const colNumber = match.index - charCount + 1;
      const lineText = lines[lineNumber - 1].trim();

      // Skip if line is a comment (tolerates // and /* ... */)
      if (lineText.startsWith('//')) continue;
      if (lineText.startsWith('* ')) continue;
      if (lineText.startsWith('/*')) continue;

      // Skip import statements
      if (lineText.startsWith('import ')) continue;

      // Skip type definitions like `type X = { filepath: string }`
      if (
        lineText.match(/^\s*(filepath|source|metadata|storageKey|storageRegion)\s*:/) &&
        (lines[lineNumber - 2] || '').match(/\b(type|interface)\s+\w+/)
      ) {
        continue;
      }

      // Context check: if rule has contextPattern, verify the preceding
      // identifier on the same line looks file-related
      if (rule.contextPattern) {
        const prefix = lineText.slice(0, colNumber - 1);
        if (!rule.contextPattern.test(prefix)) {
          continue;
        }
      }

      violations.push({
        rule: rule,
        line: lineNumber,
        col: colNumber,
        text: lineText,
      });
    }
  }

  return violations;
}

function main() {
  console.log('🔍 Scanning client source for PublicFileAssetDescriptor boundary violations...\n');

  const files = walkDir(SRC_DIR);
  let totalViolations = 0;
  let errorCount = 0;
  let warnCount = 0;
  const fileViolations = [];

  for (const { path, isTest } of files) {
    const relPath = relative(SRC_DIR, path);
    if (BOUNDARY_ADAPTER_FILES.has(relPath)) continue;

    const violations = findViolations(path, isTest);
    if (violations.length > 0) {
      fileViolations.push({ path: relPath, violations, isTest });
      totalViolations += violations.length;
      errorCount += violations.filter((v) => v.rule.severity === 'error').length;
      warnCount += violations.filter((v) => v.rule.severity === 'warn').length;
    }
  }

  if (totalViolations === 0) {
    console.log('✅ No boundary violations found.\n');
    console.log(`   Scanned ${files.length} files.`);
    process.exit(0);
  }

  for (const { path, violations, isTest } of fileViolations) {
    const label = isTest ? ' (test file)' : '';
    console.log(`📄 ${path}${label}`);
    for (const v of violations) {
      const icon = v.rule.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} Line ${v.line}:${v.col} — ${v.rule.message}`);
      console.log(`      ${v.text}`);
      console.log();
    }
  }

  console.log('---');
  console.log(`📊 Summary: ${totalViolations} violation(s) across ${fileViolations.length} file(s)`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   ⚠️  Warnings: ${warnCount}`);
  console.log(`   📁 Files scanned: ${files.length}`);
  console.log();
  console.log('💡 Remember: Frontend display code must only consume `PublicFileAssetDescriptor`.');
  console.log('   Internal fields like `source`, `filepath`, `metadata`, `storageKey` belong on the server.');
  console.log('   If you need a new display field, add it to PublicFileAssetDescriptor explicitly.');

  // Exit with error code only for errors, not warnings
  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
