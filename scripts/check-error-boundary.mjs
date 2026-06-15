#!/usr/bin/env node
/**
 * Error Boundary Checker — 禁止业务代码直接读取原始 axios/fetch 错误结构
 *
 * 架构约束（与 packages/data-provider/src/errors.ts 顶部注释保持一致）：
 *
 *   业务组件层（client/src 非白名单文件）只能消费以下 API：
 *     • normalizeError(error, options?)              统一转换为 AppError
 *     • AppError 接口上的字段 (code/category/status/...)
 *     • 12 个语义化谓词：isForbiddenError / isNotFoundError / isRetryableError
 *       / isRateLimitError / isUnauthorizedError / isNetworkError / isServerError
 *       / isValidationError / isFileError / isAbortedError / isConflictError
 *       / isServerNotReadyError
 *     • 访问器：getErrorStatus / getErrorMessage / getValidationIssues / getRateLimitInfo
 *     • 本地化：getLocalizedErrorMessage
 *
 *   以下原始字段访问一律禁止，仅允许在 error/request 边界模块内使用：
 *     • error.response?.status  /  .response?.data?.{code,error,message,limit}
 *     • error.statusCode        /  "response" in error   /  isErrorObject()
 *     • axiosError.response.*  —  Memory/Skills/MCP 之前的常见坏味道
 *
 * 运行：
 *   node scripts/check-error-boundary.mjs        # 全量扫描
 *   node scripts/check-error-boundary.mjs path/a.tsx client/src/b.js   # 指定文件
 * 对接：
 *   npm run lint:error-boundary  (root package.json)
 *   并由 CI 的 lint 阶段强制执行
 */

import { readFile, readdir } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_ROOTS = ['client/src', 'packages/data-provider/src'];
const SOURCE_DIRS = SOURCE_ROOTS.map((r) => resolve(ROOT, r));

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['__tests__', '__mocks__', 'node_modules', 'dist', '.turbo']);

/**
 * 白名单：只有这些文件被允许使用底层 axios 字段访问。
 * 所有新增条目必须同时修改 data-provider/src/errors.ts 顶部的约束说明，
 * 并在 PR 中解释为什么要穿透 AppError 边界。
 */
const WHITELIST = new Set(
  [
    'packages/data-provider/src/errors.ts',
    'packages/data-provider/src/request.ts',
    'client/src/utils/errors.ts',
    'client/src/utils/errors.js',
    'client/src/hooks/SSE/useResumableSSE.ts',
    'client/src/hooks/SSE/useResumableSSE.js',
  ].map((p) => resolve(ROOT, p)),
);

/**
 * 禁用模式：每个模式 = { name, regex, help }
 * 其中 regex 由 String.prototype.matchAll 逐行匹配，所以不要带全局 /g 标志。
 */
const FORBIDDEN_PATTERNS = [
  {
    name: 'raw-response-status',
    help: '禁止 .response?.status / .response.status — 用 isNotFoundError / isForbiddenError 等谓词',
    regex: /\.response\??\.status\b/,
  },
  {
    name: 'raw-response-data-field',
    help: '禁止 .response?.data?.{code,error,message,limit} — 用 normalizeError + getErrorMessage / AppError.code',
    regex: /\.response\??\.data\?\.?\s*(code|error|message|limit)\b/,
  },
  {
    name: 'raw-error-response',
    help: '禁止 error.response?.* — 先 normalizeError(error) 再消费 AppError',
    regex: /\berror\.response\??\.?/,
  },
  {
    name: 'raw-axios-error',
    help: '禁止 axiosError.response / axiosError.request — 边界模块才可以读取',
    regex: /\baxiosError\.response\b/,
  },
  {
    name: 'statusCode-hardcoded',
    help: '禁止 .statusCode — axios/fetch 用 status，业务层统一用 isRateLimitError 等谓词',
    regex: /\.statusCode\b/,
  },
  {
    name: 'response-in-check',
    help: '禁止 \'response\' in error — 用 isAppError() 或 normalizeError',
    regex: /["']response["']\s+in\s+\w/,
  },
  {
    name: 'isErrorObject-guard',
    help: '禁止 isErrorObject() 自定义守卫 — 统一走 normalizeError',
    regex: /\bisErrorObject\s*\(/,
  },
];

function* walkSync(dir) {
  const dirents = requireDirentCache(dir);
  for (const d of dirents) {
    const full = join(dir, d.name);
    if (d.isDirectory()) {
      if (SKIP_DIRS.has(d.name)) continue;
      yield* walkSync(full);
    } else if (d.isFile()) {
      if (EXTENSIONS.has(extname(d.name))) yield full;
    }
  }
}

/** 读目录 dir 返回 Dirent[]；同步 API 避免 5 万文件目录下的 Promise 栈。 */
function requireDirentCache(dir) {
  return readdirSync(dir, { withFileTypes: true });
}

async function collectFiles(explicitTargets) {
  if (explicitTargets.length > 0) {
    return explicitTargets
      .map((p) => resolve(process.cwd(), p))
      .filter((p) => existsSync(p) && EXTENSIONS.has(extname(p)));
  }
  const out = [];
  for (const root of SOURCE_DIRS) {
    if (!existsSync(root)) continue;
    for (const f of walkSync(root)) out.push(f);
  }
  return out;
}

function analyzeLine(line, lineNo, relPath) {
  const hits = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    // 单行可能多处命中，全部报告
    const matches = line.matchAll(new RegExp(rule.regex.source, rule.regex.flags + 'g'));
    for (const m of matches) {
      const col = (m.index ?? 0) + 1;
      const snippet = line.trimStart().slice(0, 120);
      hits.push({ lineNo, col, rule, snippet });
    }
  }
  return hits;
}

function render(violations) {
  if (violations.length === 0) {
    console.log('✅  error-boundary: 所有业务文件均通过，没有直接读取原始 axios/fetch 错误结构。');
    return 0;
  }

  console.error(`❌  error-boundary: 发现 ${violations.length} 处违反错误边界的访问：\n`);
  for (const v of violations) {
    const loc = `${v.file}:${v.lineNo}:${v.col}`;
    const header = `  ${loc}  [${v.rule.name}]`;
    console.error(header);
    console.error(`     ↳ ${v.rule.help}`);
    console.error(`     ↳ ${v.snippet}\n`);
  }

  console.error(
    `业务层只能消费：normalizeError、AppError、语义化谓词（isForbiddenError / isNotFoundError / ` +
      `isRetryableError / isRateLimitError 等）以及 getErrorMessage / getLocalizedErrorMessage。\n` +
      `如果确实需要穿透，请修改 packages/data-provider/src/errors.ts 顶部的白名单并附解释。`,
  );
  return 1;
}

async function main() {
  const explicit = process.argv.slice(2);
  const files = await collectFiles(explicit);

  const violations = [];
  for (const abs of files) {
    if (WHITELIST.has(abs)) continue;

    // 只扫描 SOURCE_ROOTS 里的源码（显式路径不受限但也不在白名单的仍然检查）
    if (explicit.length === 0 && !SOURCE_DIRS.some((root) => abs.startsWith(root + sep))) continue;

    const rel = relative(ROOT, abs);
    let content;
    try {
      content = await readFile(abs, 'utf8');
    } catch (_) {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineHits = analyzeLine(lines[i], i + 1, rel);
      for (const h of lineHits) {
        violations.push({ file: rel, ...h });
      }
    }
  }

  process.exit(render(violations));
}

main().catch((e) => {
  console.error('error-boundary script crashed:', e && e.stack ? e.stack : e);
  process.exit(2);
});
