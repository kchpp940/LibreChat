jest.mock('~/server/services/Agents/precheck', () => ({
  performAgentPrecheck: jest.fn(),
}));

jest.mock('~/server/services/Config', () => ({
  getCachedTools: jest.fn().mockResolvedValue({
    web_search: true,
    execute_code: true,
    file_search: true,
  }),
}));

jest.mock('~/server/controllers/ModelController', () => ({
  getModelsConfig: jest.fn().mockResolvedValue({
    openAI: ['gpt-4'],
  }),
}));

jest.mock('~/server/services/MCP', () => ({
  createMCPPermissionContext: jest.fn(),
  resolveConfigServers: jest.fn(),
  userCanUseMCPServers: jest.fn(),
  getServerConnectionStatus: jest.fn(),
}));

jest.mock('~/config', () => ({
  getMCPServersRegistry: jest.fn(),
  getMCPManager: jest.fn(),
}));

jest.mock('~/server/services/PermissionService', () => ({
  findAccessibleResources: jest.fn().mockResolvedValue([]),
  findPubliclyAccessibleResources: jest.fn().mockResolvedValue([]),
  getResourcePermissionsMap: jest.fn().mockResolvedValue(new Map()),
  grantPermission: jest.fn(),
}));

jest.mock('~/models', () => ({
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  getAgent: jest.fn(),
  deleteFileByFilter: jest.fn(),
}));

jest.mock('~/cache', () => ({
  getLogStores: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('~/server/services/Files/process', () => ({
  filterFile: jest.fn(),
}));

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(),
}));

jest.mock('~/server/services/Files/images/avatar', () => ({
  resizeAvatar: jest.fn(),
}));

jest.mock('sharp', () =>
  jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({}),
    toFormat: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  })),
);

jest.mock('@librechat/api', () => ({
  ...jest.requireActual('@librechat/api'),
  refreshS3Url: jest.fn(),
}));

jest.mock('nanoid', () => ({ nanoid: jest.fn().mockReturnValue('test-nanoid') }));

const {
  createAgent: createAgentHandler,
  updateAgent: updateAgentHandler,
  precheckAgent: precheckAgentHandler,
} = require('./v1');

const { performAgentPrecheck } = require('~/server/services/Agents/precheck');
const db = require('~/models');
const {
  PrecheckSeverity,
  PrecheckCategory,
} = require('librechat-data-provider');

const PrecheckCode = {
  REQUIRED_NAME_MISSING: 'required.name_missing',
  REQUIRED_PROVIDER_MISSING: 'required.provider_missing',
  REQUIRED_MODEL_MISSING: 'required.model_missing',
  REQUIRED_CATEGORY_EMPTY: 'required.category_empty',
  REQUIRED_INSTRUCTIONS_EMPTY: 'required.instructions_empty',
  MODEL_CONFIG_NOT_LOADED: 'model.config_not_loaded',
  MODEL_PROVIDER_UNAVAILABLE: 'model.provider_unavailable',
  MODEL_NOT_AVAILABLE: 'model.not_available',
  MODEL_ENDPOINT_DISABLED: 'model.endpoint_disabled',
  MODEL_CAPABILITY_FILE_SEARCH: 'model.capability_file_search',
  MODEL_CAPABILITY_EXECUTE_CODE: 'model.capability_execute_code',
  MODEL_CAPABILITY_WEB_SEARCH: 'model.capability_web_search',
  MODEL_CAPABILITY_TOOLS: 'model.capability_tools',
  MODEL_CAPABILITY_CONTEXT: 'model.capability_context',
  MODEL_CAPABILITY_SUBAGENTS: 'model.capability_subagents',
  MODEL_CAPABILITY_SKILLS: 'model.capability_skills',
  MODEL_VERIFY_FAILED: 'model.verify_failed',
  TOOL_NOT_AVAILABLE: 'tool.not_available',
  TOOL_MCP_PERMISSION_DENIED: 'tool.mcp_permission_denied',
  TOOL_MCP_REGISTRY_UNAVAILABLE: 'tool.mcp_registry_unavailable',
  TOOL_MCP_CONFIG_LOAD_FAILED: 'tool.mcp_config_load_failed',
  TOOL_MCP_MALFORMED_KEY: 'tool.mcp_malformed_key',
  TOOL_MCP_SERVER_NOT_ACCESSIBLE: 'tool.mcp_server_not_accessible',
  TOOL_VERIFY_FAILED: 'tool.verify_failed',
  MCP_OAUTH_REQUIRED: 'mcp.oauth_required',
  MCP_OAUTH_FAILED: 'mcp.oauth_failed',
  MCP_INSPECTION_FAILED: 'mcp.inspection_failed',
  MCP_DISCONNECTED: 'mcp.disconnected',
  MCP_CONNECTING: 'mcp.connecting',
  MCP_STATUS_CHECK_FAILED: 'mcp.status_check_failed',
  FILE_NOT_FOUND: 'file.not_found',
  FILE_PERMISSION_DENIED: 'file.permission_denied',
  FILE_INDEX_PENDING: 'file.index_pending',
  FILE_INDEX_FAILED: 'file.index_failed',
  FILE_INDEX_SKIPPED: 'file.index_skipped',
  FILE_VERIFY_FAILED: 'file.verify_failed',
  SKILL_INVALID_ID: 'skill.invalid_id',
  SKILL_NOT_FOUND: 'skill.not_found',
  SKILL_PERMISSION_DENIED: 'skill.permission_denied',
  SKILL_VERIFY_FAILED: 'skill.verify_failed',
  AGENT_EDGE_MISSING: 'agent.edge_missing',
  AGENT_EDGE_UNAUTHORIZED: 'agent.edge_unauthorized',
  AGENT_SUBAGENT_MISSING: 'agent.subagent_missing',
  AGENT_SUBAGENT_UNAUTHORIZED: 'agent.subagent_unauthorized',
};

function makeMockResult(overrides = {}) {
  const items = overrides.items ?? [];
  return {
    valid: overrides.valid ?? items.filter((i) => i.severity === 'error').length === 0,
    items,
    blockingErrors: items.filter((i) => i.severity === 'error'),
    warnings: items.filter((i) => i.severity === 'warning'),
    ...overrides,
  };
}

function makeErrorItem(code, category, message, field) {
  return {
    severity: PrecheckSeverity.ERROR,
    category: category ?? PrecheckCategory.MODEL_AVAILABILITY,
    code: code ?? PrecheckCode.MODEL_NOT_AVAILABLE,
    message: message ?? 'Test error',
    field: field ?? 'model',
  };
}

function makeWarningItem(code, category, message, field) {
  return {
    severity: PrecheckSeverity.WARNING,
    category: category ?? PrecheckCategory.FILE_INDEX,
    code: code ?? PrecheckCode.FILE_INDEX_SKIPPED,
    message: message ?? 'Test warning',
    field: field ?? 'tool_resources',
  };
}

describe('Agent Controller Precheck Consistency', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { id: 'test-user-id', role: 'USER' },
      body: {},
      app: { locals: {} },
      config: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('precheck endpoint', () => {
    test('returns precheck result as-is with blockingErrors/warnings/code', async () => {
      const items = [
        makeErrorItem(PrecheckCode.MODEL_NOT_AVAILABLE),
        makeWarningItem(PrecheckCode.FILE_INDEX_SKIPPED),
      ];
      const result = makeMockResult({ items });
      performAgentPrecheck.mockResolvedValueOnce(result);

      mockReq.body = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'bad-model',
        tools: [],
      };

      await precheckAgentHandler(mockReq, mockRes);

      expect(performAgentPrecheck).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      const responseBody = mockRes.json.mock.calls[0][0];
      expect(responseBody).toHaveProperty('blockingErrors');
      expect(responseBody).toHaveProperty('warnings');
      expect(responseBody).toHaveProperty('items');
      expect(responseBody.valid).toBe(false);
      expect(responseBody.blockingErrors.length).toBe(1);
      expect(responseBody.warnings.length).toBe(1);

      const errorCodes = responseBody.blockingErrors.map((e) => e.code);
      expect(errorCodes).toContain(PrecheckCode.MODEL_NOT_AVAILABLE);

      const warningCodes = responseBody.warnings.map((w) => w.code);
      expect(warningCodes).toContain(PrecheckCode.FILE_INDEX_SKIPPED);
    });

    test('returns valid result with empty blockingErrors', async () => {
      const result = makeMockResult({ items: [] });
      performAgentPrecheck.mockResolvedValueOnce(result);

      mockReq.body = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        tools: [],
      };

      await precheckAgentHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const responseBody = mockRes.json.mock.calls[0][0];
      expect(responseBody.valid).toBe(true);
      expect(responseBody.blockingErrors.length).toBe(0);
      expect(responseBody.warnings.length).toBe(0);
    });
  });

  describe('create endpoint', () => {
    test('returns 400 with precheck result when blockingErrors exist', async () => {
      const items = [
        makeErrorItem(PrecheckCode.MODEL_NOT_AVAILABLE),
        makeWarningItem(PrecheckCode.FILE_INDEX_SKIPPED),
      ];
      const result = makeMockResult({ items });
      performAgentPrecheck.mockResolvedValueOnce(result);

      mockReq.body = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'bad-model',
        tools: [],
      };

      await createAgentHandler(mockReq, mockRes);

      expect(performAgentPrecheck).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      const responseBody = mockRes.json.mock.calls[0][0];
      expect(responseBody).toHaveProperty('precheck');
      expect(responseBody.precheck).toHaveProperty('blockingErrors');
      expect(responseBody.precheck).toHaveProperty('warnings');
      expect(responseBody.precheck.valid).toBe(false);
      expect(responseBody.precheck.blockingErrors.length).toBe(1);
      expect(responseBody.precheck.warnings.length).toBe(1);
    });
  });

  describe('update endpoint', () => {
    test('returns 400 with precheck result when blockingErrors exist', async () => {
      const items = [
        makeErrorItem(PrecheckCode.MODEL_NOT_AVAILABLE),
      ];
      const result = makeMockResult({ items });
      performAgentPrecheck.mockResolvedValueOnce(result);

      db.getAgent.mockResolvedValueOnce({
        id: 'agent-1',
        name: 'Existing Agent',
        provider: 'openAI',
        model: 'gpt-4',
        instructions: 'existing instructions',
        category: 'general',
        tools: [],
        author: 'test-user-id',
      });

      mockReq.params = { id: 'agent-1' };
      mockReq.body = {
        model: 'bad-model',
      };

      await updateAgentHandler(mockReq, mockRes);

      expect(performAgentPrecheck).toHaveBeenCalledTimes(1);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      const responseBody = mockRes.json.mock.calls[0][0];
      expect(responseBody).toHaveProperty('precheck');
      expect(responseBody.precheck).toHaveProperty('blockingErrors');
      expect(responseBody.precheck.valid).toBe(false);
    });
  });

  describe('three-entry consistency: same precheck result shape', () => {
    const testCases = [
      {
        name: 'single blocking error',
        items: [makeErrorItem(PrecheckCode.MODEL_NOT_AVAILABLE)],
      },
      {
        name: 'multiple errors and warnings',
        items: [
          makeErrorItem(PrecheckCode.REQUIRED_NAME_MISSING, PrecheckCategory.REQUIRED_FIELDS),
          makeErrorItem(PrecheckCode.MODEL_NOT_AVAILABLE),
          makeWarningItem(PrecheckCode.FILE_INDEX_PENDING),
          makeWarningItem(PrecheckCode.REQUIRED_INSTRUCTIONS_EMPTY, PrecheckCategory.REQUIRED_FIELDS),
        ],
      },
    ];

    for (const testCase of testCases) {
      test(`"${testCase.name}" produces same blockingErrors/warnings/code across all three entry points`, async () => {
        const result = makeMockResult({ items: testCase.items });
        const expectedBlockingCodes = result.blockingErrors.map((e) => e.code).sort();
        const expectedWarningCodes = result.warnings.map((w) => w.code).sort();

        // --- precheck endpoint ---
        performAgentPrecheck.mockResolvedValue(result);
        mockRes.status.mockClear();
        mockRes.json.mockClear();
        mockReq.body = {
          name: 'Test Agent',
          provider: 'openAI',
          model: 'gpt-4',
          instructions: 'test',
          tools: [],
        };
        await precheckAgentHandler(mockReq, mockRes);
        const precheckResponse = mockRes.json.mock.calls[0][0];
        const precheckBlockingCodes = (precheckResponse.blockingErrors ?? [])
          .map((e) => e.code)
          .sort();
        const precheckWarningCodes = (precheckResponse.warnings ?? [])
          .map((w) => w.code)
          .sort();

        // --- create endpoint ---
        mockRes.status.mockClear();
        mockRes.json.mockClear();
        mockReq.body = {
          name: 'Test Agent',
          provider: 'openAI',
          model: 'gpt-4',
          instructions: 'test',
          tools: [],
        };
        await createAgentHandler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        const createResponse = mockRes.json.mock.calls[0][0];
        const createPrecheck = createResponse.precheck;
        const createBlockingCodes = (createPrecheck?.blockingErrors ?? [])
          .map((e) => e.code)
          .sort();
        const createWarningCodes = (createPrecheck?.warnings ?? [])
          .map((w) => w.code)
          .sort();

        // --- update endpoint ---
        db.getAgent.mockResolvedValue({
          id: 'agent-1',
          name: 'Existing Agent',
          provider: 'openAI',
          model: 'gpt-4',
          instructions: 'existing',
          category: 'general',
          tools: [],
          author: 'test-user-id',
        });
        mockRes.status.mockClear();
        mockRes.json.mockClear();
        mockReq.params = { id: 'agent-1' };
        mockReq.body = { name: 'Updated Agent' };
        await updateAgentHandler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        const updateResponse = mockRes.json.mock.calls[0][0];
        const updatePrecheck = updateResponse.precheck;
        const updateBlockingCodes = (updatePrecheck?.blockingErrors ?? [])
          .map((e) => e.code)
          .sort();
        const updateWarningCodes = (updatePrecheck?.warnings ?? [])
          .map((w) => w.code)
          .sort();

        // All three entry points return the same blocking error codes
        expect(precheckBlockingCodes).toEqual(expectedBlockingCodes);
        expect(createBlockingCodes).toEqual(expectedBlockingCodes);
        expect(updateBlockingCodes).toEqual(expectedBlockingCodes);

        // All three entry points return the same warning codes
        expect(precheckWarningCodes).toEqual(expectedWarningCodes);
        expect(createWarningCodes).toEqual(expectedWarningCodes);
        expect(updateWarningCodes).toEqual(expectedWarningCodes);

        // All three agree on valid status
        expect(precheckResponse.valid).toBe(false);
        expect(createPrecheck.valid).toBe(false);
        expect(updatePrecheck.valid).toBe(false);
      });
    }

    test('warning-only result: precheck returns warnings, create/update proceed without precheck', async () => {
      const items = [makeWarningItem(PrecheckCode.FILE_INDEX_SKIPPED)];
      const result = makeMockResult({ items });

      // --- precheck endpoint ---
      performAgentPrecheck.mockResolvedValue(result);
      mockRes.status.mockClear();
      mockRes.json.mockClear();
      mockReq.body = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'gpt-4',
        instructions: 'test',
        tools: [],
      };
      await precheckAgentHandler(mockReq, mockRes);
      const precheckResponse = mockRes.json.mock.calls[0][0];
      expect(precheckResponse.valid).toBe(true);
      expect(precheckResponse.warnings.length).toBe(1);
      expect(precheckResponse.blockingErrors.length).toBe(0);
    });
  });

  describe('each precheck item has machine-readable code', () => {
    test('all items from precheck endpoint carry code field', async () => {
      const items = [
        makeErrorItem(PrecheckCode.MODEL_NOT_AVAILABLE),
        makeWarningItem(PrecheckCode.FILE_INDEX_PENDING),
        makeWarningItem(PrecheckCode.REQUIRED_INSTRUCTIONS_EMPTY, PrecheckCategory.REQUIRED_FIELDS),
      ];
      const result = makeMockResult({ items });
      performAgentPrecheck.mockResolvedValueOnce(result);

      mockReq.body = {
        name: 'Test Agent',
        provider: 'openAI',
        model: 'bad-model',
        instructions: 'test',
        tools: [],
      };

      await precheckAgentHandler(mockReq, mockRes);

      const responseBody = mockRes.json.mock.calls[0][0];
      for (const item of responseBody.items) {
        expect(item).toHaveProperty('code');
        expect(typeof item.code).toBe('string');
        expect(item.code.length).toBeGreaterThan(0);
      }

      const allCodes = responseBody.items.map((i) => i.code);
      expect(allCodes).toContain(PrecheckCode.MODEL_NOT_AVAILABLE);
      expect(allCodes).toContain(PrecheckCode.FILE_INDEX_PENDING);
      expect(allCodes).toContain(PrecheckCode.REQUIRED_INSTRUCTIONS_EMPTY);
    });
  });
});
