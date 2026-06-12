const mongoose = require('mongoose');
const express = require('express');
const {
  isEnabled,
  generateCheckAccess,
  grantCreationPermissions,
  ensureLinkPermissions,
  deleteSharedLinkWithCleanup,
  updateSharedLinkPermissionsExpiration,
  isActiveExpirationDate,
  getSharedLinkExpiration,
} = require('@librechat/api');
const { logger, createTempChatExpirationDate } = require('@librechat/data-schemas');
const { PermissionTypes, Permissions, ContentTypes } = require('librechat-data-provider');
const {
  getSharedMessages,
  createSharedLink,
  updateSharedLink,
  getSharedLinks,
  getSharedLink,
  getRoleByName,
} = require('~/models');
const canAccessSharedLink = require('~/server/middleware/canAccessSharedLink');
const optionalJwtAuth = require('~/server/middleware/optionalJwtAuth');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const router = express.Router();

const checkSharedLinksAccess = generateCheckAccess({
  permissionType: PermissionTypes.SHARED_LINKS,
  permissions: [Permissions.CREATE],
  getRoleByName,
});

const resolveSharedLinkExpiration = (req, conversationId) =>
  getSharedLinkExpiration(
    { req, conversationId },
    {
      getConvo: async (userId, sourceConversationId) => {
        const Conversation = mongoose.models.Conversation;
        return Conversation.findOne(
          { conversationId: sourceConversationId, user: userId },
          'isTemporary expiredAt',
        ).lean();
      },
      createExpirationDate: createTempChatExpirationDate,
      logger,
    },
  );

/**
 * STRICT WHITELIST for shared messages at the HTTP boundary.
 *
 * This is the FINAL defensive gate before bytes are written to the
 * response. ANY field not listed here is dropped, period — even if
 * the data-schemas layer has a bug. The whitelist is deliberately
 * narrower than the data-schemas version: we do NOT allow
 * `tokenCount`, `finish_reason`, `manualSkills`, `alwaysAppliedSkills`
 * or any other non-essential field to reach the client.
 *
 * Content (`content`), files (`files`), and attachments (`attachments`)
 * are individually re-sanitized via dedicated functions below.
 */
const SHARED_MESSAGE_WHITELIST = new Set([
  'messageId',
  'parentMessageId',
  'conversationId',
  'sender',
  'text',
  'content',
  'iconURL',
  'model',
  'isCreatedByUser',
  'createdAt',
  'updatedAt',
  'unfinished',
  'error',
  'files',
  'attachments',
  'children',
]);

/**
 * STRICT WHITELIST for shared files/attachments at the HTTP boundary.
 *
 * NARROWER than the data-schemas whitelist: we re-check every field so
 * bugs in the serialization layer cannot leak internal identifiers.
 * `filepath`, `preview`, `href`, `downloadUrl`, `/api/files/*` pattern
 * values are stripped unconditionally by `sanitizeSharedFile` below.
 */
const SHARED_FILE_WHITELIST = new Set([
  'filename',
  'bytes',
  'size',
  'width',
  'height',
  'text',
  'textFormat',
  'type',
  'toolCallId',
  'status',
  'previewError',
  'messageId',
  'conversationId',
]);

const SHARED_FILE_TOOL_KEYS = new Set(['web_search', 'file_search']);

/**
 * URL patterns that must NEVER appear in a shared response. Covers:
 *  - The authenticated file download routes (/api/files/*, /files/*)
 *  - Preview/download endpoints
 *  - Code-executor download routes
 *
 * Two variants exist:
 *  - FORBIDDEN_URL_PATTERN_STRICT: applied to file/attachment fields.
 *    Also rejects any raw http(s) URL because filenames, text excerpts,
 *    etc. should never carry a full URL — this catches accidental
 *    storage-bucket hostname leaks (S3, GCS, Azure Blob, CDN signed
 *    URLs, etc.).
 *  - FORBIDDEN_URL_PATTERN_SOFT: applied to fields that ARE expected
 *    to be URLs (e.g. `iconURL`). Only strips the internal /api/files,
 *    /files, /preview, /download paths. Legitimate public CDN URLs
 *    like `https://cdn.example.com/avatar.png` are preserved.
 */
const FORBIDDEN_URL_PATTERN_STRICT = /^(\/api\/files\/|\/files\/|\/preview|\/download|\/api\/files\/code\/download|https?:\/\/)/i;
const FORBIDDEN_URL_PATTERN_SOFT = /^(\/api\/files\/|\/files\/|\/preview|\/download|\/api\/files\/code\/download)/i;

/**
 * Top-level fields dropped unconditionally from the share response.
 * NOTE: `messages` is deliberately NOT in this set — it is handled by
 * a separate branch in `enforceSharedMessagesResponse` that runs the
 * per-message sanitization contract before passing it through.
 */
const SHARED_LINK_DENYLIST = new Set(['_id', '__v', 'user']);

function sanitizeFileSearchSources(sources) {
  if (!Array.isArray(sources)) {
    return undefined;
  }
  return sources
    .filter((s) => s != null && typeof s === 'object' && !Array.isArray(s))
    .map((source) => {
      const result = {};
      if (typeof source.fileName === 'string') {
        result.fileName = source.fileName;
      }
      if (Array.isArray(source.pages)) {
        result.pages = source.pages.filter((p) => typeof p === 'number');
      }
      if (typeof source.relevance === 'number') {
        result.relevance = source.relevance;
      }
      if (
        source.pageRelevance != null &&
        typeof source.pageRelevance === 'object' &&
        !Array.isArray(source.pageRelevance)
      ) {
        result.pageRelevance = source.pageRelevance;
      }
      // Note: source.fileId is intentionally dropped at the HTTP layer.
      // The data-schemas layer may emit an anonymized token for it, but
      // we strip it here so no file identifier whatsoever reaches the
      // anonymous client — not even an opaque one.
      return result;
    })
    .filter((s) => Object.keys(s).length > 0);
}

function sanitizeToolAttachmentPayload(toolKey, value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const payload = value;
  const result = {};

  if (toolKey === 'file_search') {
    const sources = sanitizeFileSearchSources(payload.sources);
    if (sources && sources.length > 0) {
      result.sources = sources;
    }
    if (typeof payload.turn === 'number') {
      result.turn = payload.turn;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  if (toolKey === 'web_search') {
    if (typeof payload.turn === 'number') {
      result.turn = payload.turn;
    }
    if (Array.isArray(payload.organic)) {
      result.organic = payload.organic.filter(
        (r) => r != null && typeof r === 'object' && !Array.isArray(r),
      );
    }
    if (Array.isArray(payload.topStories)) {
      result.topStories = payload.topStories.filter(
        (r) => r != null && typeof r === 'object' && !Array.isArray(r),
      );
    }
    if (Array.isArray(payload.images)) {
      result.images = payload.images.filter(
        (r) => r != null && typeof r === 'object' && !Array.isArray(r),
      );
    }
    if (Array.isArray(payload.references)) {
      result.references = payload.references.filter(
        (r) => r != null && typeof r === 'object' && !Array.isArray(r),
      );
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  return undefined;
}

/**
 * Strip every non-whitelisted field from a file/attachment record, and
 * additionally reject any whitelisted string value that looks like a
 * URL or internal path. This is the HTTP-layer enforcement so it is
 * deliberately stricter than the data-schemas sanitizer.
 */
function sanitizeSharedFile(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    return undefined;
  }
  const result = {};
  for (const [key, value] of Object.entries(file)) {
    if (SHARED_FILE_WHITELIST.has(key)) {
      if (typeof value === 'string' && FORBIDDEN_URL_PATTERN_STRICT.test(value)) {
        continue;
      }
      result[key] = value;
      continue;
    }
    if (SHARED_FILE_TOOL_KEYS.has(key)) {
      const sanitized = sanitizeToolAttachmentPayload(key, value);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
      continue;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Strip sensitive fields from a single content part. Only render-relevant
 * fields are preserved; tool parameters, auth data, and internal IDs are
 * always removed at the HTTP boundary.
 */
function sanitizeSharedContentPart(part) {
  if (!part || typeof part !== 'object' || Array.isArray(part)) {
    return undefined;
  }
  const type = part.type;
  if (!type) {
    return undefined;
  }

  switch (type) {
    case ContentTypes.TEXT: {
      const result = { type };
      if (part.text !== undefined) {
        result.text = part.text;
      }
      return result;
    }
    case ContentTypes.THINK: {
      const result = { type };
      if (part.think !== undefined) {
        result.think = part.think;
      }
      return result;
    }
    case ContentTypes.ERROR: {
      const result = { type };
      if (typeof part.error === 'string') {
        result.error = part.error;
      }
      if (typeof part.text === 'string') {
        result.text = part.text;
      }
      return result;
    }
    case ContentTypes.TOOL_CALL: {
      const tc = part.tool_call;
      if (!tc || typeof tc !== 'object' || Array.isArray(tc)) {
        return undefined;
      }
      const sanitizedTc = {};
      if (typeof tc.name === 'string') {
        sanitizedTc.name = tc.name;
      }
      if (tc.output !== undefined) {
        sanitizedTc.output = tc.output;
      }
      if (typeof tc.progress === 'number') {
        sanitizedTc.progress = tc.progress;
      }
      if (tc.type !== undefined) {
        sanitizedTc.type = tc.type;
      }
      if (tc.function && typeof tc.function === 'object') {
        sanitizedTc.function = {
          ...(tc.function.name !== undefined && { name: tc.function.name }),
        };
      }
      if (tc.retrieval && typeof tc.retrieval === 'object') {
        sanitizedTc.retrieval = {};
      }
      if (tc.file_search && typeof tc.file_search === 'object') {
        sanitizedTc.file_search = {};
      }
      if (Array.isArray(tc.subagent_content)) {
        sanitizedTc.subagent_content = tc.subagent_content
          .map((p) => sanitizeSharedContentPart(p))
          .filter((p) => p !== undefined);
      }
      return { type, tool_call: sanitizedTc };
    }
    case ContentTypes.IMAGE_FILE: {
      const img = part.image_file;
      if (!img || typeof img !== 'object' || Array.isArray(img)) {
        return undefined;
      }
      const sanitizedImg = {};
      if (img.detail !== undefined) {
        sanitizedImg.detail = img.detail;
      }
      return { type, image_file: sanitizedImg };
    }
    case ContentTypes.IMAGE_URL:
    case ContentTypes.VIDEO_URL:
    case ContentTypes.INPUT_AUDIO: {
      return { type, ...(part[type] !== undefined && { [type]: part[type] }) };
    }
    case ContentTypes.AGENT_UPDATE: {
      return { type, agent_update: {} };
    }
    case ContentTypes.SUMMARY: {
      const result = { type };
      if (part.content !== undefined) {
        result.content = part.content;
      }
      if (typeof part.provider === 'string') {
        result.provider = part.provider;
      }
      if (typeof part.tokenCount === 'number') {
        result.tokenCount = part.tokenCount;
      }
      if (typeof part.summarizing === 'boolean') {
        result.summarizing = part.summarizing;
      }
      return result;
    }
    default: {
      return undefined;
    }
  }
}

/**
 * Apply the shared-message contract at the HTTP boundary using a STRICT
 * WHITELIST. Every field on the incoming message not present in
 * `SHARED_MESSAGE_WHITELIST` is dropped. Content parts, files, and
 * attachments pass through their own sanitizers; `children` is
 * processed recursively. If any forbidden-looking URL string leaks onto
 * a whitelisted text field, it is stripped too.
 *
 * This is the FINAL gate before bytes are written to the anonymous
 * client's response — it MUST be narrower than the data-schemas layer.
 */
function enforceSharedMessageContract(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return undefined;
  }

  const result = {};
  for (const [key, value] of Object.entries(message)) {
    if (!SHARED_MESSAGE_WHITELIST.has(key)) {
      continue;
    }

    if (key === 'content' && Array.isArray(value)) {
      const sanitized = value
        .map((part) => sanitizeSharedContentPart(part))
        .filter((p) => p !== undefined);
      if (sanitized.length > 0) {
        result.content = sanitized;
      }
      continue;
    }

    if (key === 'files' && Array.isArray(value)) {
      const sanitized = value
        .map((f) => sanitizeSharedFile(f))
        .filter((f) => f !== undefined);
      if (sanitized.length > 0) {
        result.files = sanitized;
      }
      continue;
    }

    if (key === 'attachments' && Array.isArray(value)) {
      const sanitized = value
        .map((f) => sanitizeSharedFile(f))
        .filter((f) => f !== undefined);
      if (sanitized.length > 0) {
        result.attachments = sanitized;
      }
      continue;
    }

    if (key === 'children' && Array.isArray(value)) {
      const sanitized = value
        .map((m) => enforceSharedMessageContract(m))
        .filter((m) => m !== undefined);
      if (sanitized.length > 0) {
        result.children = sanitized;
      }
      continue;
    }

    if (key === 'iconURL' && typeof value === 'string' && FORBIDDEN_URL_PATTERN_SOFT.test(value)) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

function enforceSharedMessagesResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const result = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SHARED_LINK_DENYLIST.has(key)) {
      continue;
    }
    if (key === 'messages' && Array.isArray(value)) {
      result.messages = value
        .map((m) => enforceSharedMessageContract(m))
        .filter((m) => m !== undefined);
      continue;
    }
    result[key] = value;
  }
  return result;
}

/**
 * Shared messages
 */
const allowSharedLinks =
  process.env.ALLOW_SHARED_LINKS === undefined || isEnabled(process.env.ALLOW_SHARED_LINKS);

if (allowSharedLinks) {
  router.get('/:shareId', optionalJwtAuth, canAccessSharedLink, async (req, res) => {
    try {
      const share = await getSharedMessages(req.params.shareId, req.shareResourceId);
      if (share) {
        res.set('Cache-Control', 'private, no-store');
        const sanitized = enforceSharedMessagesResponse(share);
        res.status(200).json(sanitized);
      } else {
        res.status(404).end();
      }
    } catch (error) {
      logger.error('Error getting shared messages:', error);
      res.status(500).json({ message: 'Error getting shared messages' });
    }
  });
}

/**
 * Shared links
 */
router.get('/', requireJwtAuth, async (req, res) => {
  try {
    const params = {
      pageParam: req.query.cursor,
      pageSize: Math.max(1, parseInt(req.query.pageSize) || 10),
      sortBy: ['createdAt', 'title'].includes(req.query.sortBy) ? req.query.sortBy : 'createdAt',
      sortDirection: ['asc', 'desc'].includes(req.query.sortDirection)
        ? req.query.sortDirection
        : 'desc',
      search: req.query.search ? decodeURIComponent(req.query.search.trim()) : undefined,
    };

    const result = await getSharedLinks(
      req.user.id,
      params.pageParam,
      params.pageSize,
      params.sortBy,
      params.sortDirection,
      params.search,
    );

    res.status(200).send({
      links: result.links,
      nextCursor: result.nextCursor,
      hasNextPage: result.hasNextPage,
    });
  } catch (error) {
    logger.error('Error getting shared links:', error);
    res.status(500).json({
      message: 'Error getting shared links',
      error: error.message,
    });
  }
});

router.get('/link/:conversationId', requireJwtAuth, async (req, res) => {
  try {
    const share = await getSharedLink(req.user.id, req.params.conversationId);

    if (share._id && share.success) {
      await ensureLinkPermissions(share._id, req.user.id);
    }

    return res.status(200).json({
      _id: share._id,
      success: share.success,
      shareId: share.shareId,
      targetMessageId: share.targetMessageId,
      conversationId: req.params.conversationId,
    });
  } catch (error) {
    logger.error('Error getting shared link:', error);
    res.status(500).json({ message: 'Error getting shared link' });
  }
});

router.post('/:conversationId', requireJwtAuth, checkSharedLinksAccess, async (req, res) => {
  try {
    const { targetMessageId } = req.body;
    const expiredAt = await resolveSharedLinkExpiration(req, req.params.conversationId);
    if (expiredAt != null && !isActiveExpirationDate(expiredAt)) {
      return res.status(404).end();
    }

    const role = await getRoleByName(req.user.role);
    const sharedLinksPerms = role?.permissions?.[PermissionTypes.SHARED_LINKS] || {};
    const grantPublic = sharedLinksPerms[Permissions.SHARE_PUBLIC] === true;

    const created = await createSharedLink(
      req.user.id,
      req.params.conversationId,
      targetMessageId,
      expiredAt,
    );
    if (created) {
      await grantCreationPermissions(created._id, req.user.id, grantPublic, expiredAt);
      res.status(200).json(created);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    logger.error('Error creating shared link:', error);
    res.status(500).json({ message: 'Error creating shared link' });
  }
});

router.patch('/:shareId', requireJwtAuth, async (req, res) => {
  try {
    const { targetMessageId } = req.body ?? {};
    if (targetMessageId !== undefined && typeof targetMessageId !== 'string') {
      return res.status(400).json({ message: 'targetMessageId must be a string' });
    }

    let expiredAt;
    const SharedLink = mongoose.models.SharedLink;
    const existing = await SharedLink.findOne(
      { shareId: req.params.shareId, user: req.user.id },
      'conversationId',
    ).lean();
    if (existing?.conversationId) {
      expiredAt = await resolveSharedLinkExpiration(req, existing.conversationId);
    }
    if (expiredAt != null && !isActiveExpirationDate(expiredAt)) {
      return res.status(404).end();
    }

    const updatedShare = await updateSharedLink(
      req.user.id,
      req.params.shareId,
      targetMessageId,
      expiredAt,
    );
    if (updatedShare) {
      if (updatedShare._id && expiredAt !== undefined) {
        await updateSharedLinkPermissionsExpiration(updatedShare._id, expiredAt);
      }
      res.status(200).json(updatedShare);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    logger.error('Error updating shared link:', error);
    res.status(500).json({ message: 'Error updating shared link' });
  }
});

router.delete('/:shareId', requireJwtAuth, async (req, res) => {
  try {
    const result = await deleteSharedLinkWithCleanup(req.user.id, req.params.shareId);

    if (!result) {
      return res.status(404).json({ message: 'Share not found' });
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error deleting shared link:', error);
    return res.status(400).json({ message: 'Error deleting shared link' });
  }
});

module.exports = router;
