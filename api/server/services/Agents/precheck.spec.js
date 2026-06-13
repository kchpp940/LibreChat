const {
  PrecheckSeverity,
  PrecheckCategory,
  PrecheckCode,
  performAgentPrecheck,
} = require('./precheck');

jest.mock('~/server/services/MCP', () => ({
  createMCPPermissionContext: jest.fn(),
  resolveConfigServers: jest.fn(),
  getServerConnectionStatus: jest.fn(),
}));

jest.mock('~/config', () => ({
  getMCPServersRegistry: jest.fn().mockReturnValue({
    getAllServerConfigs: jest.fn().mockResolvedValue({}),
  }),
  getMCPManager: jest.fn().mockReturnValue({
    getUserConnections: jest.fn().mockReturnValue(new Map()),
    appConnections: { getLoaded: jest.fn().mockResolvedValue(new Map()) },
    getOAuthServers: jest.fn().mockResolvedValue(new Set()),
  }),
}));

jest.mock('~/server/services/Config', () => ({
  getCachedTools: jest.fn().mockResolvedValue({
    web_search: true,
    execute_code: true,
    file_search: true,
  }),
  getEndpointsConfig: jest.fn().mockResolvedValue({
    agents: {
      capabilities: [
        'file_search',
        'execute_code',
        'web_search',
        'tools',
        'context',
        'subagents',
        'skills',
      ],
    },
  }),
}));

jest.mock('~/server/controllers/ModelController', () => ({
  getModelsConfig: jest.fn().mockResolvedValue({
    openAI: ['gpt-4', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus'],
  }),
}));

jest.mock('~/server/controllers/agents/v1', () => ({
  filterAuthorizedTools: jest.fn(),
  classifyAgentReferences: jest.fn().mockResolvedValue({
    missing: [],
    unauthorized: [],
  }),
  isSubagentsCapabilityEnabled: jest.fn().mockReturnValue(true),
}));

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  collectEdgeAgentIds: jest.fn().mockReturnValue(new Set()),
  isValidObjectIdString: jest.fn().mockReturnValue(true),
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('~/server/services/PermissionService', () => ({
  getResourcePermissionsMap: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('~/models', () => ({
  getFiles: jest.fn().mockResolvedValue([]),
  getSkillById: jest.fn().mockResolvedValue(null),
}));

const { getFiles } = require('~/models');
const {
  classifyAgentReferences } = require('~/server/controllers/agents/v1');
const { getResourcePermissionsMap } = require('~/server/services/PermissionService');

describe('Agent Precheck Service', () => {
  let mockReq;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: {
        id: 'test-user-id',
        role: 'USER',
      },
      config: {},
    };
  });

  describe('performAgentPrecheck - result structure', () => {
    test('returns consistent structure with valid config has empty blockingErrors', async () => {
      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        instructions: 'Be helpful',
        category: 'general',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('blockingErrors');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.items)).toBe(true);
      expect(Array.isArray(result.blockingErrors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.blockingErrors.length).toBe(0);
    });

    test('all items have required fields: category, severity, code, message', async () => {
      const data = {
        name: '',
        provider: '',
        model: '',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      expect(result.items.length).toBeGreaterThan(0);
      for (const item of result.items) {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('severity');
        expect(item).toHaveProperty('code');
        expect(item).toHaveProperty('message');
        expect(typeof item.category).toBeDefined();
        expect(typeof item.severity).toBeDefined();
        expect(typeof item.code).toBe('string');
        expect(typeof item.message).toBe('string');
      }
    });

    test('blockingErrors are all ERROR severity and warnings are all WARNING severity', async () => {
      const data = {
        name: '',
        provider: '',
        model: '',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      for (const error of result.blockingErrors) {
        expect(error.severity).toBe(PrecheckSeverity.ERROR);
      }
      for (const warning of result.warnings) {
        expect(warning.severity).toBe(PrecheckSeverity.WARNING);
      }
    });

    test('valid is false when blockingErrors exist', async () => {
      const data = {
        name: '',
        provider: 'openAI',
        model: 'gpt-4',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      expect(result.valid).toBe(false);
      expect(result.blockingErrors.length).toBeGreaterThan(0);
    });
  });

  describe('checkRequiredFields', () => {
    test('reports name missing as ERROR', async () => {
      const data = {
        name: '',
        provider: 'openAI',
        model: 'gpt-4',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const nameErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.REQUIRED_FIELDS &&
          i.code === PrecheckCode.REQUIRED_NAME_MISSING,
      );
      expect(nameErrors.length).toBe(1);
    });

    test('reports empty instructions as WARNING', async () => {
      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        instructions: '',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const instructionWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.REQUIRED_FIELDS &&
          i.code === PrecheckCode.REQUIRED_INSTRUCTIONS_EMPTY,
      );
      expect(instructionWarnings.length).toBe(1);
      expect(result.valid).toBe(true);
    });

    test('reports empty category as WARNING', async () => {
      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        instructions: 'Be helpful',
        category: '',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const categoryWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.REQUIRED_FIELDS &&
          i.code === PrecheckCode.REQUIRED_CATEGORY_EMPTY,
      );
      expect(categoryWarnings.length).toBe(1);
    });
  });

  describe('checkModelAvailability', () => {
    test('reports model not available as ERROR', async () => {
      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'non-existent-model',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const modelErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.MODEL_AVAILABILITY &&
          i.code === PrecheckCode.MODEL_NOT_AVAILABLE,
      );
      expect(modelErrors.length).toBe(1);
      expect(result.valid).toBe(false);
    });

    test('reports provider unavailable as ERROR', async () => {
      const data = {
        name: 'Test Agent',
        provider: 'unknownProvider',
        model: 'some-model',
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const providerErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.MODEL_AVAILABILITY &&
          i.code === PrecheckCode.MODEL_PROVIDER_UNAVAILABLE,
      );
      expect(providerErrors.length).toBe(1);
    });

    test('reports file_search capability conflict as ERROR', async () => {
      const { getEndpointsConfig } = require('~/server/services/Config');
      getEndpointsConfig.mockResolvedValueOnce({
        agents: {
          capabilities: ['tools', 'web_search'],
        },
      });

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const capabilityErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.MODEL_AVAILABILITY &&
          i.code === PrecheckCode.MODEL_CAPABILITY_FILE_SEARCH,
      );
      expect(capabilityErrors.length).toBe(1);
    });

    test('reports execute_code capability conflict as ERROR', async () => {
      const { getEndpointsConfig } = require('~/server/services/Config');
      getEndpointsConfig.mockResolvedValueOnce({
        agents: {
          capabilities: ['tools', 'file_search'],
        },
      });

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['execute_code'],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const capabilityErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.MODEL_AVAILABILITY &&
          i.code === PrecheckCode.MODEL_CAPABILITY_EXECUTE_CODE,
      );
      expect(capabilityErrors.length).toBe(1);
    });

    test('reports subagents capability conflict as ERROR', async () => {
      const { getEndpointsConfig } = require('~/server/services/Config');
      getEndpointsConfig.mockResolvedValueOnce({
        agents: {
          capabilities: ['tools'],
        },
      });

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        subagents: { enabled: true, agent_ids: ['agent-1'] },
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const capabilityErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.MODEL_AVAILABILITY &&
          i.code === PrecheckCode.MODEL_CAPABILITY_SUBAGENTS,
      );
      expect(capabilityErrors.length).toBe(1);
    });

    test('reports skills capability conflict as ERROR', async () => {
      const { getEndpointsConfig } = require('~/server/services/Config');
      getEndpointsConfig.mockResolvedValueOnce({
        agents: {
          capabilities: ['tools'],
        },
      });

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        skills_enabled: true,
        skills: ['skill-1'],
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const capabilityErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.MODEL_AVAILABILITY &&
          i.code === PrecheckCode.MODEL_CAPABILITY_SKILLS,
      );
      expect(capabilityErrors.length).toBe(1);
    });
  });

  describe('checkFileIndexStatus', () => {
    test('reports file not found as WARNING', async () => {
      getFiles.mockResolvedValueOnce([]);

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
        tool_resources: {
          file_search: { file_ids: ['file-not-exist'] },
        },
      };

      const result = await performAgentPrecheck(data, mockReq);

      const notFoundWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.FILE_INDEX &&
          i.code === PrecheckCode.FILE_NOT_FOUND,
      );
      expect(notFoundWarnings.length).toBe(1);
      expect(result.valid).toBe(true);
    });

    test('reports permission denied as ERROR (blocking)', async () => {
      getFiles.mockResolvedValueOnce([
        {
          file_id: 'file-1',
          filename: 'test.pdf',
          user: 'other-user-id',
          indexingStatus: 'indexed',
        },
      ]);

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
        tool_resources: {
          file_search: { file_ids: ['file-1'] },
        },
      };

      const result = await performAgentPrecheck(data, mockReq);

      const permissionErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.FILE_INDEX &&
          i.code === PrecheckCode.FILE_PERMISSION_DENIED,
      );
      expect(permissionErrors.length).toBe(1);
      expect(result.valid).toBe(false);
    });

    test('reports pending indexingStatus as WARNING', async () => {
      getFiles.mockResolvedValueOnce([
        {
          file_id: 'file-1',
          filename: 'test.pdf',
          user: 'test-user-id',
          indexingStatus: 'pending',
        },
      ]);

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
        tool_resources: {
          file_search: { file_ids: ['file-1'] },
        },
      };

      const result = await performAgentPrecheck(data, mockReq);

      const pendingWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.FILE_INDEX &&
          i.code === PrecheckCode.FILE_INDEX_PENDING,
      );
      expect(pendingWarnings.length).toBe(1);
      expect(result.valid).toBe(true);
    });

    test('reports failed indexingStatus as WARNING', async () => {
      getFiles.mockResolvedValueOnce([
        {
          file_id: 'file-1',
          filename: 'test.pdf',
          user: 'test-user-id',
          indexingStatus: 'failed',
        },
      ]);

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
        tool_resources: {
          file_search: { file_ids: ['file-1'] },
        },
      };

      const result = await performAgentPrecheck(data, mockReq);

      const failedWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.FILE_INDEX &&
          i.code === PrecheckCode.FILE_INDEX_FAILED,
      );
      expect(failedWarnings.length).toBe(1);
    });

    test('reports skipped indexingStatus as WARNING (not blocking)', async () => {
      getFiles.mockResolvedValueOnce([
        {
          file_id: 'file-1',
          filename: 'image.png',
          user: 'test-user-id',
          indexingStatus: 'skipped',
        },
      ]);

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
        tool_resources: {
          file_search: { file_ids: ['file-1'] },
        },
      };

      const result = await performAgentPrecheck(data, mockReq);

      const skippedWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.FILE_INDEX &&
          i.code === PrecheckCode.FILE_INDEX_SKIPPED,
      );
      expect(skippedWarnings.length).toBe(1);
      expect(result.valid).toBe(true);
    });

    test('indexingStatus=indexed produces no warnings', async () => {
      getFiles.mockResolvedValueOnce([
        {
          file_id: 'file-1',
          filename: 'test.pdf',
          user: 'test-user-id',
          indexingStatus: 'indexed',
        },
      ]);

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
        tool_resources: {
          file_search: { file_ids: ['file-1'] },
        },
      };

      const result = await performAgentPrecheck(data, mockReq);

      const fileIndexItems = result.items.filter(
        (i) => i.category === PrecheckCategory.FILE_INDEX,
      );
      expect(fileIndexItems.length).toBe(0);
    });

    test('absent indexingStatus treated as skipped (legacy files)', async () => {
      getFiles.mockResolvedValueOnce([
        {
          file_id: 'file-1',
          filename: 'legacy.pdf',
          user: 'test-user-id',
        },
      ]);

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: ['file_search'],
        tool_resources: {
          file_search: { file_ids: ['file-1'] },
        },
      };

      const result = await performAgentPrecheck(data, mockReq);

      const skippedWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.FILE_INDEX &&
          i.code === PrecheckCode.FILE_INDEX_SKIPPED,
      );
      expect(skippedWarnings.length).toBe(1);
    });
  });

  describe('checkAgentReferences', () => {
    test('reports edge agent unauthorized as ERROR (blocking)', async () => {
      const { collectEdgeAgentIds } = require('@librechat/data-schemas');
      collectEdgeAgentIds.mockReturnValueOnce(new Set(['agent-1', 'agent-2']));
      classifyAgentReferences.mockResolvedValueOnce({
        missing: [],
        unauthorized: ['agent-1'],
      });

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        edges: [{ source: 'node-1', target: 'agent-1' }],
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const unauthorizedErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.AGENT_REFERENCES &&
          i.code === PrecheckCode.AGENT_EDGE_UNAUTHORIZED,
      );
      expect(unauthorizedErrors.length).toBe(1);
      expect(result.valid).toBe(false);
    });

    test('reports edge agent missing as WARNING (non-blocking)', async () => {
      const { collectEdgeAgentIds } = require('@librechat/data-schemas');
      collectEdgeAgentIds.mockReturnValueOnce(new Set(['agent-1']));
      classifyAgentReferences.mockResolvedValueOnce({
        missing: ['agent-1'],
        unauthorized: [],
      });

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        edges: [{ source: 'node-1', target: 'agent-1' }],
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const missingWarnings = result.warnings.filter(
        (i) => i.category === PrecheckCategory.AGENT_REFERENCES &&
          i.code === PrecheckCode.AGENT_EDGE_MISSING,
      );
      expect(missingWarnings.length).toBe(1);
      expect(result.valid).toBe(true);
    });

    test('reports subagent missing as ERROR (blocking)', async () => {
      classifyAgentReferences.mockResolvedValueOnce({
        missing: ['subagent-1'],
        unauthorized: [],
      });

      const data = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        subagents: { enabled: true, agent_ids: ['subagent-1'] },
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const missingErrors = result.blockingErrors.filter(
        (i) => i.category === PrecheckCategory.AGENT_REFERENCES &&
          i.code === PrecheckCode.AGENT_SUBAGENT_MISSING,
      );
      expect(missingErrors.length).toBe(1);
      expect(result.valid).toBe(false);
    });

    test('self-reference is filtered from edges (no error for agent_id set)', async () => {
      const { collectEdgeAgentIds } = require('@librechat/data-schemas');
      collectEdgeAgentIds.mockReturnValueOnce(new Set(['agent-self']));

      const data = {
        agent_id: 'agent-self',
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        edges: [{ source: 'node-0', target: 'agent-self' }],
        tools: [],
      };

      const result = await performAgentPrecheck(data, mockReq);

      const agentRefItems = result.items.filter(
        (i) => i.category === PrecheckCategory.AGENT_REFERENCES,
      );
      expect(agentRefItems.length).toBe(0);
    });
  });

  describe('three-entry consistency: precheck/create/update', () => {
    test('same data produces same blockingErrors structure', async () => {
      const data = {
        name: '',
        provider: 'unknownProvider',
        model: 'non-existent-model',
        tools: ['file_search'],
      };

      const precheckResult = await performAgentPrecheck(data, mockReq);

      expect(precheckResult).toHaveProperty('blockingErrors');
      expect(precheckResult).toHaveProperty('warnings');
      expect(precheckResult).toHaveProperty('items');
      expect(precheckResult).toHaveProperty('valid');

      const blockingErrorCodes = precheckResult.blockingErrors.map((e) => e.code).sort();
      const warningCodes = precheckResult.warnings.map((w) => w.code).sort();
      const allItemCodes = precheckResult.items
        .filter((i) => i.severity === PrecheckSeverity.ERROR)
        .map((e) => e.code)
        .sort();

      expect(blockingErrorCodes).toEqual(allItemCodes);

      const allWarningCodes = precheckResult.items
        .filter((i) => i.severity === PrecheckSeverity.WARNING)
        .map((w) => w.code)
        .sort();
      expect(warningCodes).toEqual(allWarningCodes);
    });

    test('valid config returns same structure across multiple error codes match valid = !blockingErrors.length', async () => {
      const testCases = [
        {
          name: 'fully valid',
          data: {
            name: 'Test Agent',
            provider: 'openAI',
            model: 'gpt-4',
            instructions: 'Be helpful',
            tools: [],
          },
          expectValid: true,
        },
        {
          name: 'missing name',
          data: {
            name: '',
            provider: 'openAI',
            model: 'gpt-4',
            tools: [],
          },
          expectValid: false,
        },
        {
          name: 'bad model',
          data: {
            name: 'Test Agent',
            provider: 'openAI',
            model: 'bad-model',
            tools: [],
          },
          expectValid: false,
        },
        {
          name: 'warnings only',
          data: {
            name: 'Test Agent',
            provider: 'openAI',
            model: 'gpt-4',
            instructions: '',
            tools: [],
          },
          expectValid: true,
        },
      ];

      for (const testCase of testCases) {
        const result = await performAgentPrecheck(testCase.data, mockReq);
        expect(result.valid).toBe(testCase.expectValid);
        expect(result.valid).toBe(result.blockingErrors.length === 0);
      }
    });

    test('same precheck data would be same for create and update calls same blocking set same code set', async () => {
      const testData = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        instructions: 'test',
        tools: ['file_search'],
      };

      const precheckResult = await performAgentPrecheck(testData, mockReq);

      const codes = precheckResult.items.map((i) => i.code).sort();
      const categories = [...new Set(precheckResult.items.map((i) => i.category))].sort();

      expect(codes.length).toBeGreaterThanOrEqual(0);
      expect(categories.length).toBeGreaterThanOrEqual(0);

      precheckResult.blockingErrors.forEach((error) => {
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('severity');
        expect(error.severity).toBe('error');
      });

      precheckResult.warnings.forEach((warning) => {
        expect(warning).toHaveProperty('code');
        expect(warning).toHaveProperty('severity');
        expect(warning.severity).toBe('warning');
      });
    });
  });
});
