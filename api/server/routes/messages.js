const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  logger,
  serializeSearchResults,
} = require('@librechat/data-schemas');
const { ContentTypes, isAssistantsEndpoint, SearchHitType } = require('librechat-data-provider');
const {
  unescapeLaTeX,
  countTokens,
  sendFeedbackScore,
  traceIdForMessage,
} = require('@librechat/api');
const { findAllArtifacts, replaceArtifactContent } = require('~/server/services/Artifacts/update');
const { requireJwtAuth, validateMessageReq } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();
router.use(requireJwtAuth);

const SEARCH_SNIPPET_LENGTH = 150;

function generateSnippet(text, query, maxLength = SEARCH_SNIPPET_LENGTH) {
  if (!text || !query) {
    return text?.slice(0, maxLength) || '';
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) {
    return text.slice(0, maxLength);
  }
  const halfLength = Math.floor(maxLength / 2);
  const start = Math.max(0, index - halfLength);
  const end = Math.min(text.length, index + query.length + halfLength);
  let snippet = text.slice(start, end);
  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < text.length) {
    snippet = snippet + '...';
  }
  return snippet;
}

function extractArtifactTitle(text) {
  if (!text) return null;
  const match = text.match(/<artifact_identifier[^>]*title="([^"]*)"/);
  if (match) return match[1];
  const codeMatch = text.match(/```(\w+)\s*title="([^"]*)"/);
  if (codeMatch) return codeMatch[2];
  return null;
}

function buildSearchHits(message, query) {
  const hits = [];
  const { text, content, files, attachments, error } = message;

  if (text && text.toLowerCase().includes(query.toLowerCase())) {
    const artifactTitle = extractArtifactTitle(text);
    hits.push({
      type: artifactTitle ? SearchHitType.ARTIFACT : SearchHitType.TEXT,
      snippet: generateSnippet(text, query),
      field: 'text',
      artifactTitle: artifactTitle || undefined,
    });
  }

  if (error && text) {
    hits.push({
      type: SearchHitType.ERROR,
      snippet: generateSnippet(text, query),
      field: 'error',
    });
  }

  if (Array.isArray(content) && content.length > 0) {
    content.forEach((part, partIndex) => {
      if (!part) return;

      if (part.type === ContentTypes.TEXT && part.text) {
        const partText = typeof part.text === 'string' ? part.text : part.text?.text || '';
        if (partText.toLowerCase().includes(query.toLowerCase())) {
          const artifactTitle = extractArtifactTitle(partText);
          hits.push({
            type: artifactTitle ? SearchHitType.ARTIFACT : SearchHitType.TEXT,
            snippet: generateSnippet(partText, query),
            field: 'content',
            partIndex,
            artifactTitle: artifactTitle || undefined,
          });
        }
      }

      if (part.type === ContentTypes.TOOL_CALL && part.tool_call) {
        const toolCall = part.tool_call;
        const toolName = toolCall.name || toolCall.tool || '';
        const toolInput = typeof toolCall.input === 'string' ? toolCall.input : JSON.stringify(toolCall.input || {});

        if (toolName.toLowerCase().includes(query.toLowerCase()) ||
            toolInput.toLowerCase().includes(query.toLowerCase())) {
          hits.push({
            type: SearchHitType.TOOL_CALL,
            snippet: generateSnippet(toolInput || toolName, query),
            field: 'content',
            partIndex,
            toolName,
          });
        }
      }

      if (part.type === ContentTypes.ERROR) {
        const errorText = part.text || part.error || '';
        const errText = typeof errorText === 'string' ? errorText : errorText?.text || '';
        if (errText.toLowerCase().includes(query.toLowerCase())) {
          hits.push({
            type: SearchHitType.ERROR,
            snippet: generateSnippet(errText, query),
            field: 'content',
            partIndex,
          });
        }
      }
    });
  }

  if (Array.isArray(files) && files.length > 0) {
    files.forEach((file) => {
      const fileName = file.filename || file.file_name || '';
      if (fileName.toLowerCase().includes(query.toLowerCase())) {
        hits.push({
          type: SearchHitType.FILE,
          snippet: fileName,
          fileName,
        });
      }
    });
  }

  if (Array.isArray(attachments) && attachments.length > 0) {
    attachments.forEach((attachment) => {
      const attName = attachment.name || attachment.filename || '';
      const attType = attachment.type || '';
      if (attName.toLowerCase().includes(query.toLowerCase()) ||
          attType.toLowerCase().includes(query.toLowerCase())) {
        hits.push({
          type: SearchHitType.ATTACHMENT,
          snippet: attName || attType,
          fileName: attName || undefined,
          toolName: attType || undefined,
        });
      }
    });
  }

  return hits;
}

function filterMessagesByType(messages, searchTypes, query) {
  if (!searchTypes || searchTypes.length === 0) {
    return { filteredMessages: messages, searchHitsMap: {} };
  }

  const searchHitsMap = {};
  const filteredMessages = [];
  const typeSet = new Set(searchTypes);

  for (const message of messages) {
    const hits = buildSearchHits(message, query);
    const matchingHits = hits.filter((hit) => typeSet.has(hit.type));

    if (matchingHits.length > 0) {
      filteredMessages.push(message);
      searchHitsMap[message.messageId] = matchingHits;
    }
  }

  return { filteredMessages, searchHitsMap };
}

router.get('/', async (req, res) => {
  try {
    const user = req.user.id ?? '';
    const {
      cursor = null,
      sortBy = 'updatedAt',
      sortDirection = 'desc',
      pageSize: pageSizeRaw,
      conversationId,
      messageId,
      search,
      searchTypes,
    } = req.query;
    const pageSize = parseInt(pageSizeRaw, 10) || 25;

    let response;
    const sortField = ['endpoint', 'createdAt', 'updatedAt'].includes(sortBy)
      ? sortBy
      : 'createdAt';
    const sortOrder = sortDirection === 'asc' ? 1 : -1;

    if (conversationId && messageId) {
      const messages = await db.getMessages({ conversationId, messageId, user });
      response = { messages: messages?.length ? [messages[0]] : [], nextCursor: null };
    } else if (conversationId) {
      response = await db.getMessagesByCursor(
        { conversationId, user },
        { sortField, sortOrder, limit: pageSize, cursor },
      );
    } else if (search) {
      const searchResults = await db.searchMessages(search, { filter: `user = "${user}"` }, true);

      const messages = searchResults.hits || [];

      const result = await db.getConvosQueried(req.user.id, messages, cursor);

      const messageIds = [];
      const cleanedMessages = [];
      for (let i = 0; i < messages.length; i++) {
        let message = messages[i];
        if (result.convoMap[message.conversationId]) {
          messageIds.push(message.messageId);
          cleanedMessages.push(message);
        }
      }

      const dbMessages = await db.getMessages({
        user,
        messageId: { $in: messageIds },
      });

      const dbMessageMap = {};
      for (const dbMessage of dbMessages) {
        dbMessageMap[dbMessage.messageId] = dbMessage;
      }

      const activeMessagesInput = [];
      for (const message of cleanedMessages) {
        const convo = result.convoMap[message.conversationId];
        const dbMessage = dbMessageMap[message.messageId];
        if (dbMessage) {
          activeMessagesInput.push({
            message: dbMessage,
            title: convo.title,
            model: convo.model,
            endpoint: convo.endpoint,
          });
        }
      }

      const { messages: activeMessages } = serializeSearchResults(activeMessagesInput);

      let finalMessages = activeMessages;
      let searchHits = {};

      const parsedSearchTypes = Array.isArray(searchTypes)
        ? searchTypes
        : searchTypes
          ? [searchTypes]
          : [];

      if (parsedSearchTypes.length > 0) {
        const { filteredMessages, searchHitsMap } = filterMessagesByType(
          activeMessages,
          parsedSearchTypes,
          search,
        );
        finalMessages = filteredMessages;
        searchHits = searchHitsMap;
      } else {
        for (const message of activeMessages) {
          const hits = buildSearchHits(message, search);
          if (hits.length > 0) {
            searchHits[message.messageId] = hits;
          }
        }
      }

      response = { messages: finalMessages, nextCursor: null, searchHits };
    } else {
      response = { messages: [], nextCursor: null };
    }

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Creates a new branch message from a specific agent's content within a parallel response message.
 * Filters the original message's content to only include parts attributed to the specified agentId.
 * Only available for non-user messages with content attributions.
 *
 * @route POST /branch
 * @param {string} req.body.messageId - The ID of the source message
 * @param {string} req.body.agentId - The agentId to filter content by
 * @returns {TMessage} The newly created branch message
 */
router.post('/branch', async (req, res) => {
  try {
    const { messageId, agentId } = req.body;
    const userId = req.user.id;

    if (!messageId || !agentId) {
      return res.status(400).json({ error: 'messageId and agentId are required' });
    }

    const sourceMessage = await db.getMessage({ user: userId, messageId });
    if (!sourceMessage) {
      return res.status(404).json({ error: 'Source message not found' });
    }

    if (sourceMessage.isCreatedByUser) {
      return res.status(400).json({ error: 'Cannot branch from user messages' });
    }

    if (!Array.isArray(sourceMessage.content)) {
      return res.status(400).json({ error: 'Message does not have content' });
    }

    const hasAgentMetadata = sourceMessage.content.some((part) => part?.agentId);
    if (!hasAgentMetadata) {
      return res
        .status(400)
        .json({ error: 'Message does not have parallel content with attributions' });
    }

    /** @type {Array<import('librechat-data-provider').TMessageContentParts>} */
    const filteredContent = [];
    for (const part of sourceMessage.content) {
      if (part?.agentId === agentId) {
        const { agentId: _a, groupId: _g, ...cleanPart } = part;
        filteredContent.push(cleanPart);
      }
    }

    if (filteredContent.length === 0) {
      return res.status(400).json({ error: 'No content found for the specified agentId' });
    }

    const newMessageId = uuidv4();
    /** @type {import('librechat-data-provider').TMessage} */
    const newMessage = {
      messageId: newMessageId,
      conversationId: sourceMessage.conversationId,
      parentMessageId: sourceMessage.parentMessageId,
      attachments: sourceMessage.attachments,
      isCreatedByUser: false,
      model: sourceMessage.model,
      endpoint: sourceMessage.endpoint,
      sender: sourceMessage.sender,
      iconURL: sourceMessage.iconURL,
      content: filteredContent,
      unfinished: false,
      error: false,
      user: userId,
    };

    const savedMessage = await db.saveMessage(
      {
        userId: req?.user?.id,
        isTemporary: req?.body?.isTemporary,
        interfaceConfig: req?.config?.interfaceConfig,
      },
      newMessage,
      { context: 'POST /api/messages/branch' },
    );

    if (!savedMessage) {
      return res.status(500).json({ error: 'Failed to save branch message' });
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    logger.error('Error creating branch message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/artifact/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { index, original, updated } = req.body;

    if (typeof index !== 'number' || index < 0 || original == null || updated == null) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const message = await db.getMessage({ user: req.user.id, messageId });
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const artifacts = findAllArtifacts(message);
    if (index >= artifacts.length) {
      return res.status(400).json({ error: 'Artifact index out of bounds' });
    }

    // Unescape LaTeX preprocessing done by the frontend
    // The frontend escapes $ signs for display, but the database has unescaped versions
    const unescapedOriginal = unescapeLaTeX(original);
    const unescapedUpdated = unescapeLaTeX(updated);

    const targetArtifact = artifacts[index];
    let updatedText = null;

    if (targetArtifact.source === 'content') {
      const part = message.content[targetArtifact.partIndex];
      updatedText = replaceArtifactContent(
        part.text,
        targetArtifact,
        unescapedOriginal,
        unescapedUpdated,
      );
      if (updatedText) {
        part.text = updatedText;
      }
    } else {
      updatedText = replaceArtifactContent(
        message.text,
        targetArtifact,
        unescapedOriginal,
        unescapedUpdated,
      );
      if (updatedText) {
        message.text = updatedText;
      }
    }

    if (!updatedText) {
      return res.status(400).json({ error: 'Original content not found in target artifact' });
    }

    const savedMessage = await db.saveMessage(
      {
        userId: req?.user?.id,
        isTemporary: req?.body?.isTemporary,
        interfaceConfig: req?.config?.interfaceConfig,
      },
      {
        messageId,
        conversationId: message.conversationId,
        text: message.text,
        content: message.content,
        user: req.user.id,
      },
      { context: 'POST /api/messages/artifact/:messageId' },
    );

    res.status(200).json({
      conversationId: savedMessage.conversationId,
      content: savedMessage.content,
      text: savedMessage.text,
    });
  } catch (error) {
    logger.error('Error editing artifact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* Note: It's necessary to add `validateMessageReq` within route definition for correct params */
router.get('/:conversationId', validateMessageReq, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await db.getMessages({ conversationId, user: req.user.id }, '-_id -__v -user');
    res.status(200).json(messages);
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:conversationId', validateMessageReq, async (req, res) => {
  try {
    const message = { ...req.body, conversationId: req.params.conversationId };
    const reqCtx = {
      userId: req?.user?.id,
      isTemporary: req?.body?.isTemporary,
      interfaceConfig: req?.config?.interfaceConfig,
    };
    const savedMessage = await db.saveMessage(
      reqCtx,
      { ...message, user: req.user.id },
      { context: 'POST /api/messages/:conversationId' },
    );
    if (!savedMessage) {
      return res.status(400).json({ error: 'Message not saved' });
    }
    await db.saveConvo(reqCtx, savedMessage, { context: 'POST /api/messages/:conversationId' });
    res.status(201).json(savedMessage);
  } catch (error) {
    logger.error('Error saving message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:conversationId/:messageId', validateMessageReq, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const message = await db.getMessages(
      { conversationId, messageId, user: req.user.id },
      '-_id -__v -user',
    );
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(200).json(message);
  } catch (error) {
    logger.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:conversationId/:messageId', validateMessageReq, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { text, index, model } = req.body;

    if (index === undefined) {
      const tokenCount = await countTokens(text, model);
      const result = await db.updateMessage(req?.user?.id, { messageId, text, tokenCount });
      return res.status(200).json(result);
    }

    if (typeof index !== 'number' || index < 0) {
      return res.status(400).json({ error: 'Invalid index' });
    }

    const message = (
      await db.getMessages({ conversationId, messageId, user: req.user.id }, 'content tokenCount')
    )?.[0];
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const existingContent = message.content;
    if (!Array.isArray(existingContent) || index >= existingContent.length) {
      return res.status(400).json({ error: 'Invalid index' });
    }

    const updatedContent = [...existingContent];
    if (!updatedContent[index]) {
      return res.status(400).json({ error: 'Content part not found' });
    }

    const currentPartType = updatedContent[index].type;
    if (currentPartType !== ContentTypes.TEXT && currentPartType !== ContentTypes.THINK) {
      return res.status(400).json({ error: 'Cannot update non-text content' });
    }

    const oldText = updatedContent[index][currentPartType];
    updatedContent[index] = { type: currentPartType, [currentPartType]: text };

    let tokenCount = message.tokenCount;
    if (tokenCount !== undefined) {
      const oldTokenCount = await countTokens(oldText, model);
      const newTokenCount = await countTokens(text, model);
      tokenCount = Math.max(0, tokenCount - oldTokenCount) + newTokenCount;
    }

    const result = await db.updateMessage(req?.user?.id, {
      messageId,
      content: updatedContent,
      tokenCount,
    });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error updating message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:conversationId/:messageId/feedback', validateMessageReq, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { feedback } = req.body;

    const updatedMessage = await db.updateMessage(
      req?.user?.id,
      {
        messageId,
        feedback: feedback || null,
      },
      { context: 'updateFeedback' },
    );

    // Best-effort: Assistants messages do not have deterministic AgentRun traces.
    if (!isAssistantsEndpoint(updatedMessage.endpoint)) {
      sendFeedbackScore({
        traceId: traceIdForMessage(messageId),
        feedback: updatedMessage.feedback,
        metadata: {
          messageId: updatedMessage.messageId ?? messageId,
          parentMessageId: updatedMessage.parentMessageId,
          conversationId: updatedMessage.conversationId ?? conversationId,
          sessionId: updatedMessage.conversationId ?? conversationId,
          userId: req?.user?.id,
          endpoint: updatedMessage.endpoint,
          sender: updatedMessage.sender,
          isCreatedByUser: updatedMessage.isCreatedByUser,
          tokenCount: updatedMessage.tokenCount,
        },
      }).catch((err) => logger.error('[langfuse] feedback score failed:', err));
    }

    res.json({
      messageId,
      conversationId,
      feedback: updatedMessage.feedback,
    });
  } catch (error) {
    logger.error('Error updating message feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

router.delete('/:conversationId/:messageId', validateMessageReq, async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    await db.deleteMessages({ messageId, conversationId, user: req.user.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
