const express = require('express');
const { isEnabled, GenerationJobManager, hasPersistableAbortContent } = require('@librechat/api');
const { createSseStreamTelemetry } = require('@librechat/api/telemetry');
const { logger } = require('@librechat/data-schemas');
const {
  uaParser,
  checkBan,
  requireJwtAuth,
  messageIpLimiter,
  configMiddleware,
  messageUserLimiter,
} = require('~/server/middleware');
const { saveMessage, getMessages } = require('~/models');
const responses = require('./responses');
const openai = require('./openai');
const { v1 } = require('./v1');
const chat = require('./chat');

const { LIMIT_MESSAGE_IP, LIMIT_MESSAGE_USER } = process.env ?? {};

/** Untenanted jobs (pre-multi-tenancy) remain accessible if the userId check passes. */
function hasTenantMismatch(job, user) {
  return job.metadata?.tenantId != null && job.metadata.tenantId !== user.tenantId;
}

/**
 * Build a lookupExistingId callback for GenerationJobManager.
 * Tries to find an already-persisted assistant message for a legacy job by:
 * 1. Using userMessage.messageId as parentMessageId to find the assistant response
 * 2. Looking for the most recent assistant message in that conversation
 *
 * This avoids generating a new random UUID and breaking the chain to any
 * half-saved message from before responseMessageId was introduced.
 */
function buildLookupExistingId(userId) {
  return async (jobData) => {
    try {
      const userMessageId = jobData.userMessage?.messageId;
      const conversationId = jobData.conversationId;

      if (!userMessageId && !conversationId) {
        return undefined;
      }

      // Try 1: Find assistant message whose parentMessageId matches the user message ID
      if (userMessageId) {
        const messages = await getMessages({
          user: userId,
          parentMessageId: userMessageId,
          isCreatedByUser: false,
        }, 'messageId');
        if (messages && messages.length > 0) {
          logger.debug(
            `[AgentStream] Found existing assistant message via parentMessageId: ${messages[0].messageId}`,
          );
          return messages[0].messageId;
        }
      }

      // Try 2: Find the most recent assistant message in the conversation
      if (conversationId) {
        const messages = await getMessages(
          {
            user: userId,
            conversationId,
            isCreatedByUser: false,
          },
          'messageId',
        );
        if (messages && messages.length > 0) {
          // Return the last (most recent) assistant message
          const lastMessage = messages[messages.length - 1];
          logger.debug(
            `[AgentStream] Found existing assistant message via conversation lookup: ${lastMessage.messageId}`,
          );
          return lastMessage.messageId;
        }
      }

      return undefined;
    } catch (err) {
      logger.warn('[AgentStream] lookupExistingId failed, will generate new UUID:', err);
      return undefined;
    }
  };
}

const router = express.Router();

/**
 * Open Responses API routes (API key authentication handled in route file)
 * Mounted at /agents/v1/responses (full path: /api/agents/v1/responses)
 * NOTE: Must be mounted BEFORE /v1 to avoid being caught by the less specific route
 * @see https://openresponses.org/specification
 */
router.use('/v1/responses', responses);

/**
 * OpenAI-compatible API routes (API key authentication handled in route file)
 * Mounted at /agents/v1 (full path: /api/agents/v1/chat/completions)
 */
router.use('/v1', openai);

router.use(requireJwtAuth);
router.use(checkBan);
router.use(uaParser);

/**
 * Stream endpoints - mounted before chatRouter to bypass rate limiters
 * These are GET requests and don't need message body validation or rate limiting
 */

/**
 * @route GET /chat/stream/:streamId
 * @desc Subscribe to an ongoing generation job's SSE stream with replay support
 * @access Private
 * @description Sends sync event with resume state, replays missed chunks, then streams live
 * @query resume=true - Indicates this is a reconnection (sends sync event)
 */
router.get('/chat/stream/:streamId', async (req, res) => {
  const { streamId } = req.params;
  const isResume = req.query.resume === 'true';

  const job = await GenerationJobManager.getJob(streamId);
  if (!job) {
    return res.status(404).json({
      error: 'Stream not found',
      message: 'The generation job does not exist or has expired.',
    });
  }

  if (job.metadata?.userId && job.metadata.userId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (hasTenantMismatch(job, req.user)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const streamTelemetry = createSseStreamTelemetry({ req, res, streamId, isResume });

  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  streamTelemetry.recordHeadersFlushed();

  logger.debug(`[AgentStream] Client subscribed to ${streamId}, resume: ${isResume}`);

  // Build lookup callback for reconnecting legacy jobs to their existing assistant messages
  const lookupExistingId = buildLookupExistingId(req.user.id);

  const writeEvent = (event, options = {}) => {
    if (!res.writableEnded) {
      const eventName = options.eventName ?? 'message';
      const payload = `event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`;
      res.write(payload);
      streamTelemetry.recordWrite(payload, { final: options.final });
      if (typeof res.flush === 'function') {
        res.flush();
      }
      return true;
    }

    return false;
  };

  const onDone = (event) => {
    streamTelemetry.recordFinalEventEmitted();
    writeEvent(event, { final: true });
    res.end();
  };

  const onError = (error) => {
    if (!res.writableEnded) {
      streamTelemetry.recordErrorEventEmitted();
      writeEvent({ error }, { eventName: 'error' });
      res.end();
    }
  };

  let result;

  if (isResume) {
    const { subscription, resumeState, pendingEvents } =
      await GenerationJobManager.subscribeWithResume(streamId, writeEvent, onDone, onError, lookupExistingId);

    if (!res.writableEnded) {
      if (resumeState) {
        writeEvent({ sync: true, resumeState, pendingEvents });
        GenerationJobManager.markSyncSent(streamId);
        logger.debug(
          `[AgentStream] Sent sync event for ${streamId} with ${resumeState.runSteps.length} run steps, ${pendingEvents.length} pending events`,
        );
      } else if (pendingEvents.length > 0) {
        for (const event of pendingEvents) {
          writeEvent(event);
        }
        logger.warn(
          `[AgentStream] Resume state null for ${streamId}, replayed ${pendingEvents.length} gap events directly`,
        );
      }
    }

    result = subscription;
  } else {
    result = await GenerationJobManager.subscribe(streamId, writeEvent, onDone, onError);
  }

  if (!result) {
    streamTelemetry.recordSubscribeFailed();
    onError('Failed to subscribe to stream');
    return;
  }

  req.on('close', () => {
    logger.debug(`[AgentStream] Client disconnected from ${streamId}`);
    result.unsubscribe();
  });
});

/**
 * @route GET /chat/active
 * @desc Get all active generation job IDs for the current user
 * @access Private
 * @returns { activeJobIds: string[] }
 */
router.get('/chat/active', async (req, res) => {
  const activeJobIds = await GenerationJobManager.getActiveJobIdsForUser(
    req.user.id,
    req.user.tenantId,
  );
  res.json({ activeJobIds });
});

/**
 * @route GET /chat/status/:conversationId
 * @desc Check if there's an active generation job for a conversation
 * @access Private
 * @returns { active, streamId, status, aggregatedContent, createdAt, resumeState }
 */
router.get('/chat/status/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  // streamId === conversationId, so we can use getJob directly
  const job = await GenerationJobManager.getJob(conversationId);

  if (!job) {
    return res.json({ active: false });
  }

  if (job.metadata.userId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (hasTenantMismatch(job, req.user)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Get resume state which contains aggregatedContent
  // Avoid calling both getStreamInfo and getResumeState (both fetch content)
  // Pass lookupExistingId to reconnect legacy jobs to their existing assistant messages
  const lookupExistingId = buildLookupExistingId(req.user.id);
  const resumeState = await GenerationJobManager.getResumeState(conversationId, lookupExistingId);
  const isActive = job.status === 'running';

  res.json({
    active: isActive,
    streamId: conversationId,
    status: job.status,
    aggregatedContent: resumeState?.aggregatedContent ?? [],
    createdAt: job.createdAt,
    resumeState,
  });
});

/**
 * @route POST /chat/abort
 * @desc Abort an ongoing generation job
 * @access Private
 * @description Mounted before chatRouter to bypass buildEndpointOption middleware
 */
router.post('/chat/abort', async (req, res) => {
  logger.debug(`[AgentStream] ========== ABORT ENDPOINT HIT ==========`);
  logger.debug(`[AgentStream] Method: ${req.method}, Path: ${req.path}`);
  logger.debug(`[AgentStream] Body:`, req.body);

  const { streamId, conversationId, abortKey } = req.body;
  const userId = req.user?.id;

  // streamId === conversationId, so try any of the provided IDs
  // Skip "new" as it's a placeholder for new conversations, not an actual ID
  let jobStreamId =
    streamId || (conversationId !== 'new' ? conversationId : null) || abortKey?.split(':')[0];
  let job = jobStreamId ? await GenerationJobManager.getJob(jobStreamId) : null;

  // Fallback: if job not found and we have a userId, look up active jobs for user
  // This handles the case where frontend sends "new" but job was created with a UUID
  if (!job && userId) {
    logger.debug(`[AgentStream] Job not found by ID, checking active jobs for user: ${userId}`);
    const activeJobIds = await GenerationJobManager.getActiveJobIdsForUser(
      userId,
      req.user.tenantId,
    );
    if (activeJobIds.length > 0) {
      // Abort the most recent active job for this user
      jobStreamId = activeJobIds[0];
      job = await GenerationJobManager.getJob(jobStreamId);
      logger.debug(`[AgentStream] Found active job for user: ${jobStreamId}`);
    }
  }

  logger.debug(`[AgentStream] Computed jobStreamId: ${jobStreamId}`);

  if (job && jobStreamId) {
    if (job.metadata?.userId && job.metadata.userId !== userId) {
      logger.warn(`[AgentStream] Unauthorized abort attempt for ${jobStreamId} by user ${userId}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (hasTenantMismatch(job, req.user)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Build lookup callback for legacy jobs to find their already-saved assistant message
    const lookupExistingId = buildLookupExistingId(userId);

    logger.debug(`[AgentStream] Job found, aborting: ${jobStreamId}`);
    // abortJob internally calls ensureResponseMessageId with lookupExistingId
    const abortResult = await GenerationJobManager.abortJob(jobStreamId, lookupExistingId);
    logger.debug(`[AgentStream] Job aborted successfully: ${jobStreamId}`, {
      abortResultSuccess: abortResult.success,
      abortResultUserMessageId: abortResult.jobData?.userMessage?.messageId,
      abortResultResponseMessageId: abortResult.jobData?.responseMessageId,
    });

    // CRITICAL: Save partial response BEFORE returning to prevent race condition.
    // If user sends a follow-up immediately after abort, the parentMessageId must exist in DB.
    // responseMessageId is guaranteed to exist here (either from job creation or backfill above).
    if (
      abortResult.success &&
      abortResult.jobData?.userMessage?.messageId &&
      abortResult.jobData?.responseMessageId &&
      hasPersistableAbortContent(abortResult.content)
    ) {
      const { jobData, content, text } = abortResult;
      const userMessageId = jobData.userMessage.messageId;
      const responseMessageId = jobData.responseMessageId;

      const responseMessage = {
        messageId: responseMessageId,
        parentMessageId: userMessageId,
        conversationId: jobData.conversationId,
        content: content || [],
        text: text || '',
        sender: jobData.sender || 'AI',
        endpoint: jobData.endpoint,
        iconURL: jobData.iconURL,
        model: jobData.model,
        unfinished: true,
        error: false,
        isCreatedByUser: false,
        user: userId,
      };

      logger.debug(
        `[AgentStream] Abort saving with stable ID ${responseMessageId} for ${jobStreamId}`,
      );

      try {
        await saveMessage(
          {
            userId: req?.user?.id,
            isTemporary: req?.body?.isTemporary,
            interfaceConfig: req?.config?.interfaceConfig,
          },
          responseMessage,
          { context: 'api/server/routes/agents/index.js - abort endpoint' },
        );
        logger.debug(`[AgentStream] Saved partial response for: ${jobStreamId}`);
      } catch (saveError) {
        logger.error(`[AgentStream] Failed to save partial response: ${saveError.message}`);
      }
    }

    return res.json({ success: true, aborted: jobStreamId });
  }

  logger.warn(`[AgentStream] Job not found for streamId: ${jobStreamId}`);
  return res.status(404).json({ error: 'Job not found', streamId: jobStreamId });
});

router.use('/', v1);

const chatRouter = express.Router();
chatRouter.use(configMiddleware);

if (isEnabled(LIMIT_MESSAGE_IP)) {
  chatRouter.use(messageIpLimiter);
}

if (isEnabled(LIMIT_MESSAGE_USER)) {
  chatRouter.use(messageUserLimiter);
}

chatRouter.use('/', chat);
router.use('/chat', chatRouter);

module.exports = router;
