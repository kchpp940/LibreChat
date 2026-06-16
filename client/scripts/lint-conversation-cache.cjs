/**
 * Conversation Cache Access Lint Script
 *
 * Scans the client source code for direct manipulation of conversation cache,
 * which should instead go through `conversationCacheService`.
 *
 * Detected violations:
 * 1. Direct use of conversation QueryKeys (QueryKeys.conversation, allConversations,
 *    archivedConversations, projectConversations, conversationTags) outside allowed files
 * 2. Direct queryClient.setQueryData / getQueryData / invalidateQueries / removeQueries
 *    targeting conversation-related query keys
 * 3. Use of deprecated utils/convos functions
 *
 * Usage:
 *   node scripts/lint-conversation-cache.cjs
 */

const fs = require('fs');
const path = require('path');

const CLIENT_SRC = path.resolve(__dirname, '..', 'src');

const DEPRECATED_CONVO_UTILS = [
  'addConvoToAllQueries',
  'updateConvoInAllQueries',
  'removeConvoFromAllQueries',
  'upsertConvoInAllQueries',
  'addConversationToAllConversationsQueries',
];

const ALLOWED_FILES = [
  'data-provider/Conversations/cacheService.ts',
  'data-provider/Conversations/cacheService.js',
  'data-provider/Conversations/index.ts',
  'data-provider/Conversations/index.js',
  'data-provider/queries.ts',
  'data-provider/queries.js',
  'data-provider/mutations.ts',
  'data-provider/mutations.js',
  'data-provider/tags.ts',
  'data-provider/tags.js',
  'data-provider/Favorites.ts',
  'data-provider/Favorites.js',
  'data-provider/SSE/queries.ts',
  'data-provider/SSE/queries.js',
  'data-provider/Projects/mutations.ts',
  'data-provider/Projects/mutations.js',
  'utils/convos.ts',
  'utils/convos.js',
];

const ALLOWED_DIRS = [
  'data-provider/Conversations',
  'data-provider/Projects',
];

let violations = [];
let fileCount = 0;

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, callback);
    } else if (/\.(ts|tsx|js|jsx)$/.test(file) && !file.endsWith('.d.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.spec.js') && !file.endsWith('.test.ts') && !file.endsWith('.test.js')) {
      callback(fullPath);
    }
  }
}

function isAllowedFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (ALLOWED_FILES.some((f) => normalized === f || normalized.endsWith('/' + f))) {
    return true;
  }
  if (ALLOWED_DIRS.some((d) => {
    const prefix = d + '/';
    return normalized.includes('/' + prefix) || normalized.startsWith(prefix);
  })) {
    return true;
  }
  return false;
}

function hasConversationQueryKey(line) {
  if (/QueryKeys\.conversation(?!Tags|s)/.test(line)) {
    return true;
  }
  if (/QueryKeys\.allConversations/.test(line)) {
    return true;
  }
  if (/QueryKeys\.archivedConversations/.test(line)) {
    return true;
  }
  if (/QueryKeys\.projectConversations/.test(line)) {
    return true;
  }
  if (/QueryKeys\.conversationTags/.test(line)) {
    return true;
  }
  if (/\[\s*['"]allConversations['"]/.test(line)) {
    return true;
  }
  if (/\[\s*['"]archivedConversations['"]/.test(line)) {
    return true;
  }
  if (/\[\s*['"]conversation['"]/.test(line)) {
    return true;
  }
  if (/\[\s*['"]conversationTags['"]/.test(line)) {
    return true;
  }
  return false;
}

function checkFile(filePath) {
  const relPath = path.relative(CLIENT_SRC, filePath);
  if (isAllowedFile(relPath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileViolations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const trimmed = line.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
    const isImport = trimmed.startsWith('import');
    const isExport = trimmed.startsWith('export');

    if (isComment || isImport) {
      continue;
    }

    const isConversationCacheService = /conversationCacheService/.test(line);
    const isTypeReference = /['"]conversation['"]\]/.test(line) && !/QueryKeys/.test(line) && !/\[\s*['"]conversation['"],/.test(line);

    if (hasConversationQueryKey(line) && !isConversationCacheService && !isTypeReference) {
      fileViolations.push({
        line: lineNum,
        type: 'direct-query-key',
        message: 'Direct use of conversation query key — use conversationCacheService instead',
        code: trimmed.slice(0, 120),
      });
    }

    for (const util of DEPRECATED_CONVO_UTILS) {
      if (line.includes(util) && !isImport && !isExport && !isComment) {
        fileViolations.push({
          line: lineNum,
          type: 'deprecated-util',
          message: `Use of deprecated conversation utility "${util}" — use conversationCacheService instead`,
          code: trimmed.slice(0, 120),
        });
      }
    }

    const hasCacheManipulation =
      line.includes('queryClient.setQueryData') ||
      line.includes('queryClient.getQueryData') ||
      line.includes('queryClient.removeQueries') ||
      line.includes('queryClient.invalidateQueries');

    if (hasCacheManipulation && hasConversationQueryKey(line) && !isConversationCacheService) {
      fileViolations.push({
        line: lineNum,
        type: 'direct-cache-manipulation',
        message: 'Direct manipulation of conversation cache via queryClient — use conversationCacheService instead',
        code: trimmed.slice(0, 120),
      });
    }
  }

  if (fileViolations.length > 0) {
    violations.push({
      file: relPath,
      violations: fileViolations,
    });
  }
}

function printReport() {
  console.log('\n' + '='.repeat(80));
  console.log('CONVERSATION CACHE ACCESS LINT REPORT');
  console.log('='.repeat(80));
  console.log(`Scanned ${fileCount} files`);
  console.log(`Found ${violations.length} files with violations`);
  console.log(`Total violations: ${violations.reduce((sum, f) => sum + f.violations.length, 0)}`);
  console.log('='.repeat(80) + '\n');

  if (violations.length === 0) {
    console.log('✅ No violations found! All conversation cache access goes through conversationCacheService.\n');
    return;
  }

  const typeSummary = {};

  for (const fileViolation of violations) {
    console.log(`📁 ${fileViolation.file}`);
    for (const v of fileViolation.violations) {
      typeSummary[v.type] = (typeSummary[v.type] || 0) + 1;
      console.log(`  L${v.line} [${v.type}] ${v.message}`);
      console.log(`    → ${v.code}`);
    }
    console.log('');
  }

  console.log('--- Summary by type ---');
  for (const [type, count] of Object.entries(typeSummary)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\n💡 All conversation cache operations should use `conversationCacheService` from `~/data-provider`.');
  console.log('   Examples:');
  console.log('     - conversationCacheService.getConversation(queryClient, id)');
  console.log('     - conversationCacheService.setConversation(queryClient, id, convo)');
  console.log('     - conversationCacheService.updateConversation(queryClient, id, updater)');
  console.log('     - conversationCacheService.upsertConversation(queryClient, convo)');
  console.log('     - conversationCacheService.removeConversationFromCache(queryClient, id)');
  console.log('     - conversationCacheService.archiveConversation(queryClient, id, isArchived)');
  console.log('     - conversationCacheService.invalidateConversations(queryClient, type)');
  console.log('     - conversationCacheService.getConversationTags(queryClient)');
  console.log('     - conversationCacheService.fetchConversation(queryClient, id)');
  console.log('');
}

function main() {
  console.log('🔍 Scanning conversation cache access patterns...\n');

  walk(CLIENT_SRC, (filePath) => {
    fileCount++;
    checkFile(filePath);
  });

  printReport();

  const totalViolations = violations.reduce((sum, f) => sum + f.violations.length, 0);
  if (totalViolations > 0) {
    process.exit(1);
  }
}

main();
