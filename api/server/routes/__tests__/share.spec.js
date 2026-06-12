const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const mockGetSharedLinkExpiration = jest.fn();
const mockGrantCreationPermissions = jest.fn();
const mockUpdateSharedLinkPermissionsExpiration = jest.fn();
const mockSharedLinksAccess = jest.fn((_req, _res, next) => next());

jest.mock('@librechat/api', () => ({
  isEnabled: jest.fn(() => true),
  generateCheckAccess: jest.fn(() => mockSharedLinksAccess),
  grantCreationPermissions: (...args) => mockGrantCreationPermissions(...args),
  updateSharedLinkPermissionsExpiration: (...args) =>
    mockUpdateSharedLinkPermissionsExpiration(...args),
  ensureLinkPermissions: jest.fn(),
  deleteSharedLinkWithCleanup: jest.fn(),
  getSharedLinkExpiration: (...args) => mockGetSharedLinkExpiration(...args),
  isActiveExpirationDate: jest.fn((expiredAt) => expiredAt > new Date()),
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: { error: jest.fn() },
  createTempChatExpirationDate: jest.fn(() => new Date('2030-01-01T00:00:00.000Z')),
}));

jest.mock('librechat-data-provider', () => ({
  PermissionTypes: {
    SHARED_LINKS: 'SHARED_LINKS',
  },
  Permissions: {
    CREATE: 'CREATE',
    SHARE_PUBLIC: 'SHARE_PUBLIC',
  },
  RetentionMode: {
    ALL: 'all',
    TEMPORARY: 'temporary',
  },
  ContentTypes: {
    TEXT: 'text',
    THINK: 'think',
    TEXT_DELTA: 'text_delta',
    TOOL_CALL: 'tool_call',
    IMAGE_FILE: 'image_file',
    IMAGE_URL: 'image_url',
    VIDEO_URL: 'video_url',
    INPUT_AUDIO: 'input_audio',
    AGENT_UPDATE: 'agent_update',
    SUMMARY: 'summary',
    ERROR: 'error',
  },
  StepTypes: {
    TOOL_CALLS: 'tool_calls',
    MESSAGE_CREATION: 'message_creation',
  },
  ToolCallTypes: {
    FUNCTION: 'function',
    RETRIEVAL: 'retrieval',
    FILE_SEARCH: 'file_search',
    CODE_INTERPRETER: 'code_interpreter',
    TOOL_CALL: 'tool_call',
  },
}));

jest.mock('mongoose', () => ({
  models: {
    Conversation: {
      findOne: jest.fn(),
    },
    SharedLink: {
      findOne: jest.fn(),
    },
  },
}));

jest.mock('~/models', () => ({
  getSharedMessages: jest.fn(),
  createSharedLink: jest.fn(),
  updateSharedLink: jest.fn(),
  deleteSharedLink: jest.fn(),
  getSharedLinks: jest.fn(),
  getSharedLink: jest.fn(),
  getRoleByName: jest.fn(),
}));

jest.mock('~/server/middleware/canAccessSharedLink', () => (_req, _res, next) => next());
jest.mock('~/server/middleware/optionalJwtAuth', () => (req, _res, next) => next());
jest.mock('~/server/middleware/requireJwtAuth', () => (req, res, next) => next());

const { RetentionMode } = require('librechat-data-provider');
const { createTempChatExpirationDate, logger } = require('@librechat/data-schemas');
const { deleteSharedLinkWithCleanup } = require('@librechat/api');
const {
  getSharedMessages,
  createSharedLink,
  updateSharedLink,
  getRoleByName,
} = require('~/models');
const shareRouter = require('../share');

const activeExpiration = new Date('2030-01-01T00:00:00.000Z');
const expiredExpiration = new Date('2020-01-01T00:00:00.000Z');

const lean = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
});

const buildApp = ({ retentionMode = RetentionMode.TEMPORARY } = {}) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-123' };
    req.config = { interfaceConfig: { retentionMode } };
    next();
  });
  app.use('/api/share', shareRouter);
  return app;
};

describe('share routes retention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRoleByName.mockResolvedValue({
      permissions: {
        SHARED_LINKS: {
          SHARE_PUBLIC: true,
        },
      },
    });
    mockGrantCreationPermissions.mockResolvedValue(undefined);
  });

  it('prevents successful shared message responses from being cached', async () => {
    getSharedMessages.mockResolvedValue({ shareId: 'share-123', messages: [] });

    const response = await request(buildApp()).get('/api/share/share-123');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('expires new shares for retained non-temporary conversations', async () => {
    mockGetSharedLinkExpiration.mockResolvedValue(activeExpiration);
    createSharedLink.mockResolvedValue({ _id: 'link-123', shareId: 'share-123' });

    const response = await request(buildApp())
      .post('/api/share/convo-123')
      .send({ targetMessageId: 'msg-123' });

    expect(response.status).toBe(200);
    expect(mockGetSharedLinkExpiration).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'convo-123',
        req: expect.objectContaining({ user: { id: 'user-123' } }),
      }),
      expect.objectContaining({
        getConvo: expect.any(Function),
        createExpirationDate: createTempChatExpirationDate,
        logger,
      }),
    );
    const [, dependencies] = mockGetSharedLinkExpiration.mock.calls[0];
    mongoose.models.Conversation.findOne.mockReturnValue(lean({ expiredAt: activeExpiration }));
    await dependencies.getConvo('user-123', 'convo-123');
    expect(mongoose.models.Conversation.findOne).toHaveBeenCalledWith(
      { conversationId: 'convo-123', user: 'user-123' },
      'isTemporary expiredAt',
    );
    expect(createSharedLink).toHaveBeenCalledWith(
      'user-123',
      'convo-123',
      'msg-123',
      new Date('2030-01-01T00:00:00.000Z'),
    );
    expect(mockGrantCreationPermissions).toHaveBeenCalledWith(
      'link-123',
      'user-123',
      true,
      new Date('2030-01-01T00:00:00.000Z'),
    );
    expect(mockSharedLinksAccess).toHaveBeenCalled();
  });

  it('rejects new shares when the retained conversation expired', async () => {
    mockGetSharedLinkExpiration.mockResolvedValue(expiredExpiration);
    createSharedLink.mockResolvedValue({ _id: 'link-123', shareId: 'share-123' });

    const response = await request(buildApp())
      .post('/api/share/convo-123')
      .send({ targetMessageId: 'msg-123' });

    expect(response.status).toBe(404);
    expect(createSharedLink).not.toHaveBeenCalled();
  });

  it('rejects new shares for expired conversations in all retention mode', async () => {
    mockGetSharedLinkExpiration.mockResolvedValue(expiredExpiration);
    createSharedLink.mockResolvedValue({ _id: 'link-123', shareId: 'share-123' });

    const response = await request(buildApp({ retentionMode: RetentionMode.ALL }))
      .post('/api/share/convo-123')
      .send({ targetMessageId: 'msg-123' });

    expect(response.status).toBe(404);
    expect(createSharedLink).not.toHaveBeenCalled();
  });

  it('expires updated shares for retained non-temporary conversations', async () => {
    mongoose.models.SharedLink.findOne.mockReturnValue(lean({ conversationId: 'convo-123' }));
    mockGetSharedLinkExpiration.mockResolvedValue(activeExpiration);
    updateSharedLink.mockResolvedValue({ _id: 'link-456', shareId: 'share-456' });

    const response = await request(buildApp()).patch('/api/share/share-123');

    expect(response.status).toBe(200);
    expect(mongoose.models.SharedLink.findOne).toHaveBeenCalledWith(
      { shareId: 'share-123', user: 'user-123' },
      'conversationId',
    );
    expect(mockGetSharedLinkExpiration).toHaveBeenCalledTimes(1);
    expect(mockGetSharedLinkExpiration).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'convo-123',
        req: expect.objectContaining({ user: { id: 'user-123' } }),
      }),
      expect.objectContaining({
        getConvo: expect.any(Function),
        createExpirationDate: createTempChatExpirationDate,
        logger,
      }),
    );
    expect(updateSharedLink).toHaveBeenCalledWith(
      'user-123',
      'share-123',
      undefined,
      new Date('2030-01-01T00:00:00.000Z'),
    );
    expect(mockUpdateSharedLinkPermissionsExpiration).toHaveBeenCalledWith(
      'link-456',
      new Date('2030-01-01T00:00:00.000Z'),
    );
  });

  it('rejects updated shares when the retained conversation expired', async () => {
    mongoose.models.SharedLink.findOne.mockReturnValue(lean({ conversationId: 'convo-123' }));
    mockGetSharedLinkExpiration.mockResolvedValue(expiredExpiration);
    updateSharedLink.mockResolvedValue({ shareId: 'share-456' });

    const response = await request(buildApp()).patch('/api/share/share-123');

    expect(response.status).toBe(404);
    expect(updateSharedLink).not.toHaveBeenCalled();
  });

  it('rejects updated shares for expired conversations in all retention mode', async () => {
    mongoose.models.SharedLink.findOne.mockReturnValue(lean({ conversationId: 'convo-123' }));
    mockGetSharedLinkExpiration.mockResolvedValue(expiredExpiration);
    updateSharedLink.mockResolvedValue({ shareId: 'share-456' });

    const response = await request(buildApp({ retentionMode: RetentionMode.ALL })).patch(
      '/api/share/share-123',
    );

    expect(response.status).toBe(404);
    expect(mongoose.models.SharedLink.findOne).toHaveBeenCalledWith(
      { shareId: 'share-123', user: 'user-123' },
      'conversationId',
    );
    expect(updateSharedLink).not.toHaveBeenCalled();
  });

  it('clears updated share expiration when the conversation is no longer retained', async () => {
    mongoose.models.SharedLink.findOne.mockReturnValue(lean({ conversationId: 'convo-123' }));
    mockGetSharedLinkExpiration.mockResolvedValue(null);
    updateSharedLink.mockResolvedValue({ _id: 'link-456', shareId: 'share-456' });

    const response = await request(buildApp()).patch('/api/share/share-123');

    expect(response.status).toBe(200);
    expect(updateSharedLink).toHaveBeenCalledWith('user-123', 'share-123', undefined, null);
    expect(mockUpdateSharedLinkPermissionsExpiration).toHaveBeenCalledWith('link-456', null);
    expect(mockSharedLinksAccess).not.toHaveBeenCalled();
  });

  it('preserves updated share expiration when the conversation cannot be found', async () => {
    mongoose.models.SharedLink.findOne.mockReturnValue(lean({ conversationId: 'convo-123' }));
    mockGetSharedLinkExpiration.mockResolvedValue(undefined);
    updateSharedLink.mockResolvedValue({ shareId: 'share-456' });

    const response = await request(buildApp()).patch('/api/share/share-123');

    expect(response.status).toBe(200);
    expect(updateSharedLink).toHaveBeenCalledWith('user-123', 'share-123', undefined, undefined);
    expect(mockUpdateSharedLinkPermissionsExpiration).not.toHaveBeenCalled();
  });

  it('clears updated share expiration when creating a new expiration throws', async () => {
    const error = new Error('bad config');
    mongoose.models.SharedLink.findOne.mockReturnValue(lean({ conversationId: 'convo-123' }));
    mockGetSharedLinkExpiration.mockImplementationOnce(async (_input, dependencies) => {
      dependencies.logger.error('[getSharedLinkExpiration] Error creating expiration date:', error);
      return null;
    });
    updateSharedLink.mockResolvedValue({ _id: 'link-456', shareId: 'share-456' });

    const response = await request(buildApp()).patch('/api/share/share-123');

    expect(response.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      '[getSharedLinkExpiration] Error creating expiration date:',
      error,
    );
    expect(updateSharedLink).toHaveBeenCalledWith('user-123', 'share-123', undefined, null);
    expect(mockUpdateSharedLinkPermissionsExpiration).toHaveBeenCalledWith('link-456', null);
  });

  it('updates share target message while applying retention expiration', async () => {
    mongoose.models.SharedLink.findOne.mockReturnValue(lean({ conversationId: 'convo-123' }));
    mockGetSharedLinkExpiration.mockResolvedValue(activeExpiration);
    updateSharedLink.mockResolvedValue({ shareId: 'share-456', targetMessageId: 'msg-456' });

    const response = await request(buildApp())
      .patch('/api/share/share-123')
      .send({ targetMessageId: 'msg-456' });

    expect(response.status).toBe(200);
    expect(updateSharedLink).toHaveBeenCalledWith(
      'user-123',
      'share-123',
      'msg-456',
      new Date('2030-01-01T00:00:00.000Z'),
    );
  });

  it('rejects non-string target message updates', async () => {
    const response = await request(buildApp())
      .patch('/api/share/share-123')
      .send({ targetMessageId: 123 });

    expect(response.status).toBe(400);
    expect(updateSharedLink).not.toHaveBeenCalled();
  });

  it('allows deleting existing shares without CREATE permission gate', async () => {
    deleteSharedLinkWithCleanup.mockResolvedValue({ shareId: 'share-123' });

    const response = await request(buildApp()).delete('/api/share/share-123');

    expect(response.status).toBe(200);
    expect(mockSharedLinksAccess).not.toHaveBeenCalled();
    expect(deleteSharedLinkWithCleanup).toHaveBeenCalledWith('user-123', 'share-123');
  });
});

/**
 * HTTP-BOUNDARY SECURITY TESTS
 *
 * These tests simulate a "malicious / buggy" `getSharedMessages` data layer
 * that returns internal identifiers, tool parameters, and sensitive URLs.
 * They verify the `enforceSharedMessagesResponse` defense-in-depth gate in
 * `share.js` strips them REGARDLESS of what the underlying layer returns.
 */
describe('share route GET /:shareId — HTTP boundary sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRoleByName.mockResolvedValue({
      permissions: { SHARED_LINKS: { SHARE_PUBLIC: true } },
    });
    mockGrantCreationPermissions.mockResolvedValue(undefined);
  });

  function buildLeakySharedResponse() {
    return {
      shareId: 'share-anon-123',
      conversationId: 'convo-public-abc',
      title: 'Public Share',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      _id: 'must-be-stripped',
      __v: 3,
      user: 'owner-user-id',
      messages: [
        {
          messageId: 'msg-visible-1',
          parentMessageId: null,
          conversationId: 'convo-public-abc',
          sender: 'assistant',
          text: 'Here is the document summary',
          isCreatedByUser: false,
          createdAt: '2025-01-01',
          updatedAt: '2025-01-02',
          // ---> Fields below must be stripped by the HTTP gate.
          endpoint: 'azure-gpt-4',
          conversationSignature: 'sig-private',
          metadata: { traceId: 'trace-XYZ', agentVersion: '0.9-beta' },
          assistant_id: 'asst_private_42',
          agent_id: 'agent_secret_7',
          thread_id: 'thread_abc123',
          tokenCount: 4521,
          finish_reason: 'stop',
          manualSkills: ['secret-skill'],
          alwaysAppliedSkills: ['brand-voice-v2'],
          codeEnvRef: 'env-private-ref',
          embedding_model: 'text-embedding-3',
          files_config: { retention: 'PRIVATE' },
          // ---> Internal tool_call (args leak):
          content: [
            {
              type: 'tool_call',
              tool_call: {
                id: 'call_raw_internal',
                name: 'retrieval',
                args: {
                  index_id: 'private-index-999',
                  secret_key: 'sk-live-leak',
                  file_ids: ['file_SECRET_1', 'file_SECRET_2'],
                },
                auth: 'https://auth.example.com/authorize?token=live-123',
                expires_at: 1735689600,
                output: [{ summary: 'Found matching docs' }],
              },
            },
          ],
          files: [
            {
              filename: 'Report.pdf',
              bytes: 204800,
              file_id: 'file_infra_uuid',
              file_path_v2: '/api/files/download/LEAKED_ID',
              filepath: '/files/secret-report.pdf',
              preview: '/api/files/preview/LEAKED_ID',
              storageKey: 's3://private-bucket/2025/report.pdf',
              storageRegion: 'us-east-1',
              user: 'owner-user-id',
              metadata: { classification: 'CONFIDENTIAL' },
              temp_file_id: 'tmp_leak_123',
              _id: 'mongo_doc_id',
            },
          ],
          attachments: [
            {
              type: 'file_search',
              filename: 'search.json',
              file_id: 'att_LEAKED',
              filepath: '/api/files/download/att_LEAKED',
              toolCallId: 'call_internal_search',
              // ---> Artifact id leaks:
              artifactId: 'artifact_PRIVATE_123',
              artifact_ids: ['artifact_1', 'artifact_2'],
              file_search: {
                turn: 0,
                sources: [
                  {
                    fileId: 'INTERNAL_UUID_FILE',
                    fileName: 'Roadmap.docx',
                    pages: [5],
                    metadata: {
                      s3Path: '/secret/roadmap.docx',
                      owner: 'c-suite@private.co',
                    },
                  },
                ],
              },
              // Agent avatar internal path leak
              avatar: { filepath: '/api/files/code/download/agent/avatar.png' },
            },
          ],
        },
      ],
    };
  }

  it('strips denylisted top-level share fields (_id, __v, user, messages populated ref)', async () => {
    getSharedMessages.mockResolvedValue(buildLeakySharedResponse());

    const response = await request(buildApp()).get('/api/share/share-anon-123');

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('_id');
    expect(response.body).not.toHaveProperty('__v');
    expect(response.body).not.toHaveProperty('user');
  });

  it('strips every non-whitelisted message field: endpoint, metadata, assistant_id, agent_id, thread_id, tokens, finish_reason, skills, env refs', async () => {
    getSharedMessages.mockResolvedValue(buildLeakySharedResponse());

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');
    const message = body.messages?.[0];
    expect(message).toBeDefined();

    const allowedMsgKeys = new Set([
      'messageId', 'parentMessageId', 'conversationId', 'sender', 'text',
      'content', 'iconURL', 'model', 'isCreatedByUser', 'createdAt',
      'updatedAt', 'unfinished', 'error', 'files', 'attachments', 'children',
    ]);
    for (const key of Object.keys(message)) {
      expect(allowedMsgKeys.has(key)).toBe(true);
    }

    // Individual leak assertions (for failure clarity)
    expect(message).not.toHaveProperty('endpoint');
    expect(message).not.toHaveProperty('conversationSignature');
    expect(message).not.toHaveProperty('metadata');
    expect(message).not.toHaveProperty('assistant_id');
    expect(message).not.toHaveProperty('agent_id');
    expect(message).not.toHaveProperty('thread_id');
    expect(message).not.toHaveProperty('tokenCount');
    expect(message).not.toHaveProperty('finish_reason');
    expect(message).not.toHaveProperty('manualSkills');
    expect(message).not.toHaveProperty('alwaysAppliedSkills');
    expect(message).not.toHaveProperty('codeEnvRef');
    expect(message).not.toHaveProperty('embedding_model');
    expect(message).not.toHaveProperty('files_config');
  });

  it('strips tool_call args, auth, expires_at from content parts (only name/output/type survive)', async () => {
    getSharedMessages.mockResolvedValue(buildLeakySharedResponse());

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');
    const toolPart = body.messages?.[0]?.content?.[0];
    expect(toolPart?.type).toBe('tool_call');
    const tc = toolPart?.tool_call;
    expect(tc).toBeDefined();
    expect(tc).not.toHaveProperty('args');
    expect(tc).not.toHaveProperty('auth');
    expect(tc).not.toHaveProperty('expires_at');
    expect(tc.name).toBe('retrieval');
    expect(tc.output).toEqual([{ summary: 'Found matching docs' }]);
  });

  it('strips file_id, filepath, preview, download URLs and storage internals from files[]', async () => {
    getSharedMessages.mockResolvedValue(buildLeakySharedResponse());

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');
    const file = body.messages?.[0]?.files?.[0];
    expect(file).toBeDefined();
    // Render data is kept
    expect(file.filename).toBe('Report.pdf');
    expect(file.bytes).toBe(204800);
    // Identifier + URL fields are stripped
    expect(file).not.toHaveProperty('file_id');
    expect(file).not.toHaveProperty('temp_file_id');
    expect(file).not.toHaveProperty('_id');
    expect(file).not.toHaveProperty('filepath');
    expect(file).not.toHaveProperty('file_path_v2');
    expect(file).not.toHaveProperty('preview');
    expect(file).not.toHaveProperty('storageKey');
    expect(file).not.toHaveProperty('storageRegion');
    expect(file).not.toHaveProperty('user');
    expect(file).not.toHaveProperty('metadata');
  });

  it('strips artifact ids, download URLs, and file_search source metadata from attachments', async () => {
    getSharedMessages.mockResolvedValue(buildLeakySharedResponse());

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');
    const att = body.messages?.[0]?.attachments?.[0];
    expect(att).toBeDefined();
    expect(att.type).toBe('file_search');
    // Artifact IDs must never leak
    expect(att).not.toHaveProperty('artifactId');
    expect(att).not.toHaveProperty('artifact_ids');
    // Download URLs must be stripped
    expect(att).not.toHaveProperty('file_id');
    expect(att).not.toHaveProperty('filepath');
    // Avatar/internal nested file URLs stripped
    expect(att).not.toHaveProperty('avatar');

    // file_search sources keep fileName/pages but strip internal fileId and metadata
    const sources = att.file_search?.sources;
    expect(sources).toHaveLength(1);
    const src = sources[0];
    expect(src.fileName).toBe('Roadmap.docx');
    expect(src.pages).toEqual([5]);
    // HTTP layer more aggressive: NO fileId at all, not even anonymized
    expect(src).not.toHaveProperty('fileId');
    expect(src).not.toHaveProperty('metadata');
  });

  it('strips any string value matching /api/files/*, /files/*, /preview, /download from whitelisted fields', async () => {
    const leaky = buildLeakySharedResponse();
    // Inject a URL-shaped value into `filename` (corner case — normally a name, but must still reject)
    // and also inject into `text` which shouldn't be stripped (it's user content).
    leaky.messages[0].files[0].filename = '/api/files/download/poison.pdf';
    leaky.messages[0].files[0].previewError = '/download/leak-me';
    leaky.messages[0].text = 'Visit /api/files/download/x for more info'; // user text — NOT stripped

    getSharedMessages.mockResolvedValue(leaky);

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');
    const file = body.messages?.[0]?.files?.[0];

    // Fields that are on the whitelist but match FORBIDDEN_URL_PATTERN: stripped
    expect(file).not.toHaveProperty('filename');
    expect(file).not.toHaveProperty('previewError');

    // User message text is NOT a file-whitelist field with URL semantics, preserved
    expect(body.messages[0].text).toContain('/api/files/download/x');
  });

  it('strips iconURL values that point to internal /api/files/ routes', async () => {
    const leaky = buildLeakySharedResponse();
    leaky.messages[0].iconURL = '/api/files/download/agent-avatar.png';
    getSharedMessages.mockResolvedValue(leaky);

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');

    expect(body.messages[0]).not.toHaveProperty('iconURL');
  });

  it('keeps legitimate iconURL CDN URLs (non-forbidden patterns survive)', async () => {
    const leaky = buildLeakySharedResponse();
    leaky.messages[0].iconURL = 'https://cdn.example.com/icons/assistant.png';
    getSharedMessages.mockResolvedValue(leaky);

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');

    expect(body.messages[0].iconURL).toBe('https://cdn.example.com/icons/assistant.png');
  });

  it('drops unknown content types entirely (defense in depth vs. content type zero-days)', async () => {
    const leaky = buildLeakySharedResponse();
    leaky.messages[0].content = [
      { type: 'internal_debug_dump', stacktrace: 'at SecretClass.doWork()' },
      { type: 'text', text: 'safe visible text' },
      { type: 'agent_private_state', config: { apiKey: 'sk-leak' } },
    ];
    getSharedMessages.mockResolvedValue(leaky);

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');

    expect(body.messages[0].content).toHaveLength(1);
    expect(body.messages[0].content[0]).toEqual({ type: 'text', text: 'safe visible text' });
  });

  it('drops files and attachments entirely if every single field is stripped', async () => {
    const leaky = buildLeakySharedResponse();
    // Make every field on the file either forbidden or URL-shaped:
    leaky.messages[0].files = [
      {
        filename: '/files/leak.png',
        filepath: '/files/leak.png',
        file_id: 'abc',
        storageKey: 's3://x',
      },
    ];
    leaky.messages[0].attachments = [
      {
        filename: '/download/leak.json',
        filepath: '/download/leak.json',
        metadata: { secret: '1' },
      },
    ];
    getSharedMessages.mockResolvedValue(leaky);

    const { body } = await request(buildApp()).get('/api/share/share-anon-123');

    expect(body.messages[0]).not.toHaveProperty('files');
    expect(body.messages[0]).not.toHaveProperty('attachments');
  });

  it('returns 404 when getSharedMessages returns null (expired/nonexistent share)', async () => {
    getSharedMessages.mockResolvedValue(null);

    const response = await request(buildApp()).get('/api/share/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({});
  });
});
