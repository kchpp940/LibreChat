#!/usr/bin/env node
/**
 * lint-conversation-cache.js
 *
 * Scans for direct manipulation of conversation query keys and cache operations
 * that should be encapsulated within the ConversationCacheService.
 *
 * Only ./src/data-provider/Conversations/cacheService.{ts,js} is allowed to
 * directly reference conversation query keys or manipulate infinite page data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..', 'src');

const CONVERSATION_QUERY_KEYS = [
  'QueryKeys.conversation',
  'QueryKeys.allConversations',
  'QueryKeys.archivedConversations',
  'QueryKeys.projectConversations',
  'QueryKeys.conversationTags',
];

const QUERY_CLIENT_METHODS = [
  'setQueryData',
  'getQueryData',
  'invalidateQueries',
  'removeQueries',
  'cancelQueries',
  'resetQueries',
  'refetchQueries',
  'setQueriesData',
  'getQueriesData',
];

const INFINITE_PAGE_PATTERNS = [
  /\.pages\s*\[/,
  /\.pages\s*\./,
  /page\.conversations/,
  /page\.nextCursor/,
  /pageParams/,
];

const ALLOWED_FILES = [
  'src/data-provider/Conversations/cacheService.ts',
  'src/data-provider/Conversations/cacheService.js',
  'src/data-provider/Conversations/hooks.ts',
  'src/data-provider/Conversations/hooks.js',
  'src/data-provider/Conversations/mutations.ts',
  'src/data-provider/Conversations/mutations.js',
  'src/data-provider/Conversations/index.ts',
  'src/data-provider/Conversations/index.js',
  'src/utils/convos.ts',
  'src/utils/convos.js',
  'src/utils/convos.spec.ts',
  'src/utils/convos.spec.js',
  'src/utils/collection.ts',
  'src/utils/collection.js',
];

const EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  '__tests__',
];

const EXCLUDED_FILE_PATTERNS = [
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\.test\.(ts|tsx|js|jsx)$/,
];

function isAllowedFile(filePath) {
  const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
  return ALLOWED_FILES.some(allowed => relativePath === allowed);
}

function isExcludedDir(dirPath) {
  const relativePath = path.relative(path.resolve(__dirname, '..'), dirPath).replace(/\\/g, '/');
  return EXCLUDED_DIRS.some(excluded => relativePath.includes(excluded));
}

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!isExcludedDir(filePath)) {
        results = results.concat(getAllFiles(filePath, extensions));
      }
    } else if (extensions.some(ext => file.endsWith(ext))) {
      // Skip test files
      if (EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(file))) {
        continue;
      }
      results.push(filePath);
    }
  }

  return results;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');

  const issues = [];

  // Check for direct conversation query key usage
  for (const key of CONVERSATION_QUERY_KEYS) {
    const regex = new RegExp(key.replace(/\./g, '\\.'), 'g');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        // Skip imports and comments
        if (line.trim().startsWith('import') || line.trim().startsWith('//') || line.trim().startsWith('*')) {
          continue;
        }
        // Skip type-only references (in generics or type annotations)
        if (line.includes('type ') || line.includes('interface ') || line.includes(':')) {
          continue;
        }
        issues.push({
          line: i + 1,
          column: line.indexOf(key) + 1,
          message: `Direct use of ${key} - use ConversationCacheService instead`,
          severity: 'error',
        });
      }
    }
  }

  // Check for queryClient methods with conversation-related keys
  for (const method of QUERY_CLIENT_METHODS) {
    const regex = new RegExp(`\\.${method}\\s*\\(`, 'g');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        // Check if this method call involves conversation keys (more precise check)
        const nextFewLines = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
        const involvesConversationKey = CONVERSATION_QUERY_KEYS.some(key =>
          nextFewLines.includes(key)  // Exact match of the full key
        );
        // Also check for array patterns like [QueryKeys.conversation, ...]
        const arrayPattern = /\[\s*QueryKeys\s*\.\s*(conversation|allConversations|archivedConversations|projectConversations|conversationTags)/;
        const hasConversationArrayKey = arrayPattern.test(nextFewLines);
        if (involvesConversationKey || hasConversationArrayKey) {
          issues.push({
            line: i + 1,
            column: line.indexOf(method) + 1,
            message: `Direct use of queryClient.${method} with conversation key - use ConversationCacheService instead`,
            severity: 'error',
          });
        }
      }
    }
  }

  // Check for infinite page pattern manipulations
  for (const pattern of INFINITE_PAGE_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (pattern.test(line)) {
        // Skip if it's in cacheService
        if (isAllowedFile(filePath)) {
          continue;
        }
        // Check if this is related to conversation data (more strict)
        const context = lines[Math.max(0, i - 5)] + ' ' + lines[Math.max(0, i - 2)] + ' ' + line + ' ' + lines[Math.min(i + 2, lines.length - 1)] + ' ' + lines[Math.min(i + 5, lines.length - 1)];
        const conversationRelated =
          (context.includes('conversation') || context.includes('conversations') || context.includes('Conversations'))
          && !context.includes('projectConversations')
          && !context.includes('page.projects')
          && !context.includes('.projects')
          && !context.includes('ProjectsInfiniteQuery')
          && !context.includes('useProjectsInfiniteQuery')
          && !context.includes('TCollection')
          && !context.includes('collectionName')
          && !context.includes('TData');
        if (conversationRelated) {
          // Skip if it's just reading data or using the hook's computed values
          if (line.includes('conversations') && (line.includes('useConversationsInfiniteQuery') || line.includes('flattenConversations'))) {
            continue;
          }
          issues.push({
            line: i + 1,
            column: line.search(pattern) + 1,
            message: `Direct manipulation of infinite page data - use ConversationCacheService instead`,
            severity: 'warning',
          });
        }
      }
    }
  }

  return issues;
}

function main() {
  const files = getAllFiles(ROOT);
  const allIssues = [];

  for (const file of files) {
    if (isAllowedFile(file)) {
      continue;
    }

    const issues = scanFile(file);
    if (issues.length > 0) {
      const relativePath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
      allIssues.push({
        file: relativePath,
        issues,
      });
    }
  }

  // Format output
  let errorCount = 0;
  let warningCount = 0;

  console.log('\n=== Conversation Cache Lint Results ===\n');

  if (allIssues.length === 0) {
    console.log('✅ No conversation cache violations found!');
    process.exit(0);
  }

  for (const { file, issues } of allIssues) {
    console.log(`📁 ${file}`);
    for (const issue of issues) {
      const prefix = issue.severity === 'error' ? '  ❌' : '  ⚠️';
      console.log(`${prefix} Line ${issue.line}:${issue.column} - ${issue.message}`);
      if (issue.severity === 'error') errorCount++;
      else warningCount++;
    }
    console.log('');
  }

  console.log(`=== Summary ===`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Warnings: ${warningCount}`);
  console.log(`Total files with issues: ${allIssues.length}`);

  if (errorCount > 0) {
    console.log('\n❌ Conversation cache violations detected. Please fix before committing.');
    process.exit(1);
  } else if (warningCount > 0) {
    console.log('\n⚠️  Warnings detected. Please review.');
    process.exit(0);
  }
}

main();
