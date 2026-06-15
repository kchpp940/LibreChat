#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_SRC = path.resolve(__dirname, '..', 'client', 'src');

const FORBIDDEN_PATTERNS = [
  {
    pattern: /startupConfig\??\.sharedLinksEnabled/g,
    message: 'Use `useCanShareConversations()` from CapabilitiesContext instead of `startupConfig.sharedLinksEnabled`',
  },
  {
    pattern: /startupConfig\??\.publicSharedLinksEnabled/g,
    message: 'Use `useCanSharePublicly()` from CapabilitiesContext instead of `startupConfig.publicSharedLinksEnabled`',
  },
  {
    pattern: /startupConfig\??\.bundlerURL/g,
    message: 'Use `useArtifactBundlerURLs()` from CapabilitiesContext instead of `startupConfig.bundlerURL`',
  },
  {
    pattern: /startupConfig\??\.staticBundlerURL/g,
    message: 'Use `useArtifactBundlerURLs()` from CapabilitiesContext instead of `startupConfig.staticBundlerURL`',
  },
  {
    pattern: /startupConfig\??\.sharePointFilePickerEnabled/g,
    message: 'Use `useCanUseSharePoint()` from CapabilitiesContext instead of `startupConfig.sharePointFilePickerEnabled`',
  },
  {
    pattern: /startupConfig\??\.conversationImportMaxFileSize/g,
    message: 'Use `useConversationImportMaxFileSize()` from CapabilitiesContext instead of `startupConfig.conversationImportMaxFileSize`',
  },
  {
    pattern: /startupConfig\??\.webSearch(?!Enabled)/g,
    message: 'Use `useWebSearchCapabilities()` from CapabilitiesContext instead of `startupConfig.webSearch`',
  },
  {
    pattern: /config\??\.webSearch\??\.(searchProvider|scraperProvider|rerankerType)/g,
    message: 'Use `useWebSearchCapabilities()` from CapabilitiesContext instead of `config.webSearch.*`',
  },
  {
    pattern: /startupConfig\??\.interface\??\.(modelSelect|parameters|multiConvo|bookmarks|memories|presets|temporaryChat|autoSubmitFromUrl|runCode|fileSearch|fileCitations|buildInfo|customWelcome|privacyPolicy|termsOfService)/g,
    message: 'Use `useInterfaceFlags()` from CapabilitiesContext instead of `startupConfig.interface.*`',
  },
  {
    pattern: /startupConfig\??\.interface\??\.mcpServers/g,
    message: 'Use `useMcpServerCapabilities()` from CapabilitiesContext instead of `startupConfig.interface.mcpServers`',
  },
  {
    pattern: /startupConfig\??\.interface\??\.skills/g,
    message: 'Use `useCapabilities().skills` from CapabilitiesContext instead of `startupConfig.interface.skills`',
  },
  {
    pattern: /interfaceConfig\s*=\s*(?:useMemo\(\(\)\s*=>\s*)?startupConfig\??\.interface/g,
    message: 'Use `useInterfaceFlags()` from CapabilitiesContext instead of deriving `interfaceConfig` from `startupConfig.interface`',
  },
];

const ALLOWED_DIRS = [
  'components',
  'hooks',
  'routes',
  'Providers',
  'store',
  'utils',
  'data-provider',
  'common',
  'lib',
];

const SKIP_PATTERNS = [
  /CapabilitiesContext\.(ts|js)x?$/,
  /__tests__/,
  /\.spec\.(ts|js)x?$/,
  /\.test\.(ts|js)x?$/,
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (/\.(ts|js)x?$/.test(file)) {
      results.push(filePath);
    }
  }
  return results;
}

function checkFile(filePath) {
  const relative = path.relative(CLIENT_SRC, filePath);

  for (const skip of SKIP_PATTERNS) {
    if (skip.test(relative)) {
      return [];
    }
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];

  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const before = content.substring(0, match.index);
      const line = (before.match(/\n/g) || []).length + 1;
      violations.push({
        file: relative,
        line,
        match: match[0],
        message,
      });
    }
  }

  return violations;
}

function main() {
  console.log('Scanning client/src for forbidden raw capability field reads...\n');

  const files = walk(CLIENT_SRC);
  const allViolations = [];

  for (const file of files) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log('✅ No forbidden raw capability field reads found. All clear!\n');
    process.exit(0);
  }

  console.log(`❌ Found ${allViolations.length} violation(s):\n`);

  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    Found: ${v.match}`);
    console.log(`    ${v.message}\n`);
  }

  process.exit(1);
}

main();
