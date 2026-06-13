import { nanoid } from 'nanoid';
import { Constants } from 'librechat-data-provider';
import type { FilterQuery, Model } from 'mongoose';
import type { SchemaWithMeiliMethods } from '~/models/plugins/mongoMeili';
import type * as t from '~/types';
import { SHARED_MESSAGE_ALLOWED_FIELDS } from '~/types/share';
import { activeExpirationFilter } from '~/utils/retention';
import logger from '~/config/winston';

class ShareServiceError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ShareServiceError';
    this.code = code;
  }
}

function memoizedAnonymizeId(prefix: string) {
  const memo = new Map<string, string>();
  return (id: string) => {
    if (!memo.has(id)) {
      memo.set(id, `${prefix}_${nanoid()}`);
    }
    return memo.get(id) as string;
  };
}

const anonymizeConvoId = memoizedAnonymizeId('convo');
const anonymizeAssistantId = memoizedAnonymizeId('a');
const anonymizeMessageId = (id: string) =>
  id === Constants.NO_PARENT ? id : memoizedAnonymizeId('msg')(id);

function anonymizeConvo(conversation: Partial<t.IConversation> & Partial<t.ISharedLink>) {
  if (!conversation) {
    return null;
  }

  const newConvo = { ...conversation };
  if (newConvo.assistant_id) {
    newConvo.assistant_id = anonymizeAssistantId(newConvo.assistant_id);
  }
  return newConvo;
}

/**
 * Storage- and identity-internal fields that must never be exposed through a
 * public shared link. Everything else on a file/attachment — including the
 * `filepath`/`preview` render URLs, dimensions, and tool-call payloads such as
 * `toolCallId` and search results — is render data the shared view needs, so it
 * is preserved. (`storageKey` is the raw object key and is dropped; `filepath`
 * is the URL the share renderer actually loads, so it is kept.)
 */
const SENSITIVE_SHARED_FILE_FIELDS = new Set([
  '_id',
  '__v',
  'user',
  'tenantId',
  'storageRegion',
  'storageKey',
  'temp_file_id',
  'message',
  'source',
  'filterSource',
  'context',
  'embedded',
  'usage',
  'metadata',
]);

/**
 * Strip storage/identity-internal fields from a file or attachment while keeping
 * render-relevant data (including tool-call payloads keyed by tool name).
 */
function sanitizeSharedFile(value: unknown): t.SharedFile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const result: t.SharedFile = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (!SENSITIVE_SHARED_FILE_FIELDS.has(key)) {
      result[key] = fieldValue;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeSharedFiles(files: unknown): t.SharedFile[] | undefined {
  if (!Array.isArray(files)) {
    return undefined;
  }

  const sanitized = files
    .map(sanitizeSharedFile)
    .filter((file): file is t.SharedFile => file != null);

  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Only surface a model name when it is an (already-anonymized) assistant id;
 * otherwise omit it so the underlying provider/model is not disclosed.
 */
function anonymizeSharedModel(model?: string): string | undefined {
  if (!model?.startsWith('asst_')) {
    return undefined;
  }
  return anonymizeAssistantId(model);
}

/**
 * Build the public, anonymized view of shared messages. An allowlist of
 * render-relevant fields keeps internal message fields (endpoint,
 * conversationSignature, clientId, plugin(s), metadata, etc.) out of the
 * payload, while user files and tool-call attachments are sanitized field by
 * field so render data (uploaded files, `toolCallId`, search results, generated
 * outputs) is preserved without leaking storage internals.
 */
function anonymizeMessages(messages: t.IMessage[], newConvoId: string): t.SharedMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  const idMap = new Map<string, string>();
  return messages.map((message) => {
    const newMessageId = anonymizeMessageId(message.messageId);
    idMap.set(message.messageId, newMessageId);

    const attachments = sanitizeSharedFiles(message.attachments)?.map((attachment) => ({
      ...attachment,
      messageId: newMessageId,
      conversationId: newConvoId,
    }));
    // Persisted file records can carry the original conversation/message ids;
    // rewrite them to the anonymized ids so shared files don't expose them.
    const files = sanitizeSharedFiles(message.files)?.map((file) => ({
      ...file,
      ...(file.conversationId !== undefined && { conversationId: newConvoId }),
      ...(file.messageId !== undefined && { messageId: newMessageId }),
    }));
    const model = anonymizeSharedModel(message.model);

    return {
      messageId: newMessageId,
      parentMessageId:
        idMap.get(message.parentMessageId || '') ||
        anonymizeMessageId(message.parentMessageId || ''),
      conversationId: newConvoId,
      sender: message.sender,
      text: message.text,
      content: message.content,
      ...(message.iconURL && { iconURL: message.iconURL }),
      ...(model && { model }),
      isCreatedByUser: message.isCreatedByUser,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      tokenCount: message.tokenCount,
      unfinished: message.unfinished,
      error: message.error,
      finish_reason: message.finish_reason,
      ...(message.manualSkills && { manualSkills: message.manualSkills }),
      ...(message.alwaysAppliedSkills && { alwaysAppliedSkills: message.alwaysAppliedSkills }),
      ...(files && { files }),
      ...(attachments && { attachments }),
    };
  });
}

/**
 * Filter messages up to and including the target message (branch-specific)
 * Similar to getMessagesUpToTargetLevel from fork utilities
 */
function assertSharedMessageFieldsOnly(msg: t.SharedMessage, context: string): void {
  const ownKeys = Object.keys(msg);
  for (const key of ownKeys) {
    if (!SHARED_MESSAGE_ALLOWED_FIELDS.has(key as keyof t.SharedMessage)) {
      throw new Error(
        `[buildTourData] Attempted to access non-whitelisted field "${key}" on SharedMessage in context "${context}". ` +
          `Allowed fields: ${Array.from(SHARED_MESSAGE_ALLOWED_FIELDS).join(', ')}`,
      );
    }
  }
  const proto = Object.getPrototypeOf(msg);
  if (proto && proto !== Object.prototype) {
    throw new Error(
      `[buildTourData] SharedMessage has unexpected prototype in context "${context}". ` +
        `Only plain objects allowed to prevent access to mongoose/virtual fields.`,
    );
  }
}

function createGuardedSharedMessage(msg: t.SharedMessage, context: string): t.SharedMessage {
  assertSharedMessageFieldsOnly(msg, context);
  return new Proxy(msg, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'string') {
        if (!SHARED_MESSAGE_ALLOWED_FIELDS.has(prop as keyof t.SharedMessage)) {
          throw new Error(
            `[buildTourData] Attempted to read non-whitelisted field "${prop}" on SharedMessage in context "${context}". ` +
              `Allowed: ${Array.from(SHARED_MESSAGE_ALLOWED_FIELDS).join(', ')}`,
          );
        }
      }
      return target[prop as keyof t.SharedMessage];
    },
    has(target, prop: string | symbol) {
      if (
        typeof prop === 'string' &&
        !SHARED_MESSAGE_ALLOWED_FIELDS.has(prop as keyof t.SharedMessage)
      ) {
        return false;
      }
      return prop in target;
    },
    ownKeys(target) {
      return Array.from(SHARED_MESSAGE_ALLOWED_FIELDS).filter((k) => k in target);
    },
    getOwnPropertyDescriptor(target, prop: string | symbol) {
      if (
        typeof prop === 'string' &&
        !SHARED_MESSAGE_ALLOWED_FIELDS.has(prop as keyof t.SharedMessage)
      ) {
        return undefined;
      }
      return Object.getOwnPropertyDescriptor(target, prop);
    },
  });
}

function truncateLabel(text: string, maxLen = 80): string {
  if (!text) {
    return '';
  }
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  return cleaned.slice(0, maxLen - 1) + '…';
}

const CONTENT_PART_ALLOWED_KEYS = new Set([
  'type',
  'text',
  'think',
  'error',
  'tool_call',
  'image_file',
]);

const TOOL_CALL_OBJ_ALLOWED_KEYS = new Set(['type', 'id', 'name', 'output', 'function']);

const TOOL_CALL_FUNCTION_ALLOWED_KEYS = new Set(['name']);

const FILE_REF_ALLOWED_KEYS = new Set([
  'filename',
  'filepath',
  'type',
  'contentType',
  'toolCallId',
]);

function truncateOutput(raw: unknown, maxLen = 100): string | undefined {
  if (raw == null || typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen - 1) + '…' : trimmed;
}

function sanitizeToolCallForTour(
  tc: unknown,
): { toolName: string; toolCallId?: string; outputPreview?: string } | null {
  if (!tc || typeof tc !== 'object') {
    return null;
  }
  const src = tc as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    if (!TOOL_CALL_OBJ_ALLOWED_KEYS.has(key)) {
      return null;
    }
  }
  let name: string | undefined;
  if (typeof src.name === 'string') {
    name = src.name;
  } else if (src.function && typeof src.function === 'object') {
    const funcObj = src.function as Record<string, unknown>;
    if (typeof funcObj.name === 'string') {
      name = funcObj.name;
    }
  }
  if (!name) {
    return null;
  }
  const funcObj = src.function as Record<string, unknown> | undefined;
  if (funcObj && typeof funcObj === 'object') {
    for (const key of Object.keys(funcObj)) {
      if (!TOOL_CALL_FUNCTION_ALLOWED_KEYS.has(key)) {
        return null;
      }
    }
  }
  return {
    toolName: name,
    toolCallId: typeof src.id === 'string' ? src.id : undefined,
    outputPreview: truncateOutput(src.output),
  };
}

function sanitizeContentPartForTour(part: unknown): Record<string, unknown> | null {
  if (!part || typeof part !== 'object') {
    return null;
  }
  const src = part as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    if (!CONTENT_PART_ALLOWED_KEYS.has(key)) {
      continue;
    }
    result[key] = src[key];
  }
  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeFileRefForTour(file: unknown): t.TourFileRef | null {
  if (!file || typeof file !== 'object') {
    return null;
  }
  const src = file as Record<string, unknown>;
  const result: t.TourFileRef = {};
  let hasRelevantField = false;
  for (const key of Object.keys(src)) {
    if (!FILE_REF_ALLOWED_KEYS.has(key)) {
      continue;
    }
    if (key === 'filename' && typeof src[key] === 'string') {
      result.filename = src[key] as string;
      hasRelevantField = true;
    } else if (key === 'type' && typeof src[key] === 'string') {
      result.filetype = src[key] as string;
      hasRelevantField = true;
    } else if (key === 'contentType' && typeof src[key] === 'string' && !result.filetype) {
      result.filetype = src[key] as string;
      hasRelevantField = true;
    } else if (key === 'filepath' && typeof src[key] === 'string' && !result.filename) {
      hasRelevantField = true;
    } else if (key === 'toolCallId') {
      hasRelevantField = true;
    }
  }
  return hasRelevantField ? result : null;
}

function extractToolCallsFromContent(
  content: unknown,
): Array<{ toolName: string; toolCallId?: string; outputPreview?: string }> {
  if (!Array.isArray(content)) {
    return [];
  }
  const results: Array<{ toolName: string; toolCallId?: string; outputPreview?: string }> = [];
  for (const rawPart of content) {
    const part = sanitizeContentPartForTour(rawPart);
    if (
      !part ||
      part.type !== 'tool_call' ||
      !part.tool_call ||
      typeof part.tool_call !== 'object'
    ) {
      continue;
    }
    const sanitized = sanitizeToolCallForTour(part.tool_call);
    if (sanitized) {
      results.push(sanitized);
    }
  }
  return results;
}

function buildTourData(messages: t.SharedMessage[]): t.TourData {
  const items: t.TourItem[] = [];
  let assistantCount = 0;
  let toolCallCount = 0;
  let fileCount = 0;

  for (const rawMsg of messages) {
    const msg = createGuardedSharedMessage(rawMsg, `buildTourData@${rawMsg.messageId}`);
    const anchorId = `share-msg-${msg.messageId}`;

    if (msg.isCreatedByUser) {
      const userFiles: t.TourFileRef[] = [];
      if (Array.isArray(msg.files)) {
        for (const f of msg.files) {
          const sanitized = sanitizeFileRefForTour(f);
          if (sanitized && sanitized.filename) {
            userFiles.push(sanitized);
          }
        }
      }
      if (userFiles.length > 0) {
        fileCount += userFiles.length;
        items.push({
          messageId: msg.messageId,
          anchorId,
          category: 'file',
          label: truncateLabel(userFiles.map((f) => f.filename || 'File').join(', ')),
          files: userFiles,
        });
      }
      continue;
    }

    const toolCalls = extractToolCallsFromContent(msg.content);
    const msgFiles: t.TourFileRef[] = [];
    if (Array.isArray(msg.files)) {
      for (const f of msg.files) {
        const sanitized = sanitizeFileRefForTour(f);
        if (sanitized && sanitized.filename) {
          msgFiles.push(sanitized);
        }
      }
    }
    const attachToolCalls: t.TourToolCall[] = [];
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (!att || typeof att !== 'object') {
          continue;
        }
        const src = att as Record<string, unknown>;
        const toolName =
          FILE_REF_ALLOWED_KEYS.has('type') && typeof src.type === 'string' ? src.type : undefined;
        if (!toolName) {
          continue;
        }
        const toolCallId =
          FILE_REF_ALLOWED_KEYS.has('toolCallId') && typeof src.toolCallId === 'string'
            ? src.toolCallId
            : undefined;
        attachToolCalls.push({ toolName, toolCallId });
        toolCallCount++;
      }
    }

    const allToolCalls = [...toolCalls, ...attachToolCalls];
    if (allToolCalls.length > 0) {
      toolCallCount += toolCalls.length;
    }
    fileCount += msgFiles.length;

    if (msg.error) {
      items.push({
        messageId: msg.messageId,
        anchorId,
        category: 'error',
        label: truncateLabel(msg.text || 'Error'),
      });
      continue;
    }

    assistantCount++;
    const label = truncateLabel(msg.text || msg.sender || 'Assistant');

    const hasArtifact = allToolCalls.some(
      (tc) => tc.toolName === 'code_interpreter' || tc.toolName === 'artifacts',
    );

    if (hasArtifact) {
      items.push({
        messageId: msg.messageId,
        anchorId,
        category: 'artifact',
        label,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        files: msgFiles.length > 0 ? msgFiles : undefined,
      });
    } else if (allToolCalls.length > 0) {
      items.push({
        messageId: msg.messageId,
        anchorId,
        category: 'tool_call',
        label,
        toolCalls: allToolCalls,
        files: msgFiles.length > 0 ? msgFiles : undefined,
      });
    } else if (msgFiles.length > 0) {
      items.push({
        messageId: msg.messageId,
        anchorId,
        category: 'file',
        label,
        files: msgFiles,
      });
    } else {
      items.push({
        messageId: msg.messageId,
        anchorId,
        category: 'assistant',
        label,
      });
    }
  }

  return {
    items,
    totalMessages: messages.length,
    assistantCount,
    toolCallCount,
    fileCount,
  };
}

function getMessagesUpToTarget(messages: t.IMessage[], targetMessageId: string): t.IMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  // If only one message and it's the target, return it
  if (messages.length === 1 && messages[0]?.messageId === targetMessageId) {
    return messages;
  }

  // Create a map of parentMessageId to children messages
  const parentToChildrenMap = new Map<string, t.IMessage[]>();
  for (const message of messages) {
    const parentId = message.parentMessageId || Constants.NO_PARENT;
    if (!parentToChildrenMap.has(parentId)) {
      parentToChildrenMap.set(parentId, []);
    }
    parentToChildrenMap.get(parentId)?.push(message);
  }

  // Find the target message
  const targetMessage = messages.find((msg) => msg.messageId === targetMessageId);
  if (!targetMessage) {
    // If target not found, return all messages for backwards compatibility
    return messages;
  }

  const visited = new Set<string>();
  const rootMessages = parentToChildrenMap.get(Constants.NO_PARENT) || [];
  let currentLevel = rootMessages.length > 0 ? [...rootMessages] : [targetMessage];
  const results = new Set<t.IMessage>(currentLevel);

  // Check if the target message is at the root level
  if (
    currentLevel.some((msg) => msg.messageId === targetMessageId) &&
    targetMessage.parentMessageId === Constants.NO_PARENT
  ) {
    return Array.from(results);
  }

  // Iterate level by level until the target is found
  let targetFound = false;
  while (!targetFound && currentLevel.length > 0) {
    const nextLevel: t.IMessage[] = [];
    for (const node of currentLevel) {
      if (visited.has(node.messageId)) {
        continue;
      }
      visited.add(node.messageId);
      const children = parentToChildrenMap.get(node.messageId) || [];
      for (const child of children) {
        if (visited.has(child.messageId)) {
          continue;
        }
        nextLevel.push(child);
        results.add(child);
        if (child.messageId === targetMessageId) {
          targetFound = true;
        }
      }
    }
    currentLevel = nextLevel;
  }

  return Array.from(results);
}

/** Factory function that takes mongoose instance and returns the methods */
export function createShareMethods(mongoose: typeof import('mongoose')): {
  getSharedLink: (user: string, conversationId: string) => Promise<t.GetShareLinkResult>;
  getSharedLinks: (
    user: string,
    pageParam?: Date,
    pageSize?: number,
    sortBy?: string,
    sortDirection?: string,
    search?: string,
  ) => Promise<t.SharedLinksResult>;
  createSharedLink: (
    user: string,
    conversationId: string,
    targetMessageId?: string,
    expiredAt?: Date,
  ) => Promise<t.CreateShareResult>;
  updateSharedLink: (
    user: string,
    shareId: string,
    targetMessageId?: string,
    expiredAt?: Date | null,
  ) => Promise<t.UpdateShareResult>;
  deleteSharedLink: (user: string, shareId: string) => Promise<t.DeleteShareResult | null>;
  getSharedMessages: (
    shareId: string,
    shareObjectId?: string,
  ) => Promise<t.SharedMessagesResult | null>;
  deleteAllSharedLinks: (
    user: string,
  ) => Promise<t.DeleteAllSharesResult & { deletedIds: string[] }>;
  deleteConvoSharedLink: (
    user: string,
    conversationId: string,
  ) => Promise<t.DeleteAllSharesResult & { deletedIds: string[] }>;
} {
  /**
   * Get shared messages for a share link
   */
  async function getSharedMessages(
    shareId: string,
    shareObjectId?: string,
  ): Promise<t.SharedMessagesResult | null> {
    try {
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const query = shareObjectId
        ? SharedLink.findOne({ _id: shareObjectId, ...activeExpirationFilter<t.ISharedLink>() })
        : SharedLink.findOne({ shareId, ...activeExpirationFilter<t.ISharedLink>() });

      const share = (await query
        .populate({
          path: 'messages',
          select: '-_id -__v -user',
        })
        .select('-_id -__v -user')
        .lean()) as (t.ISharedLink & { messages: t.IMessage[] }) | null;

      if (!share?.conversationId) {
        return null;
      }

      /** Filtered messages based on targetMessageId if present (branch-specific sharing) */
      let messagesToShare: t.IMessage[] = share.messages;
      if (share.targetMessageId) {
        messagesToShare = getMessagesUpToTarget(share.messages, share.targetMessageId);
      }

      const newConvoId = anonymizeConvoId(share.conversationId);
      const anonymized = anonymizeMessages(messagesToShare, newConvoId);
      const tour = buildTourData(anonymized);
      const result: t.SharedMessagesResult = {
        shareId: share.shareId || shareId,
        title: share.title,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt,
        conversationId: newConvoId,
        messages: anonymized,
        tour,
      };

      return result;
    } catch (error) {
      logger.error('[getSharedMessages] Error getting share link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shareId,
      });
      throw new ShareServiceError('Error getting share link', 'SHARE_FETCH_ERROR');
    }
  }

  /**
   * Get shared links for a specific user with pagination and search
   */
  async function getSharedLinks(
    user: string,
    pageParam?: Date,
    pageSize: number = 10,
    sortBy: string = 'createdAt',
    sortDirection: string = 'desc',
    search?: string,
  ): Promise<t.SharedLinksResult> {
    try {
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const Conversation = mongoose.models.Conversation as SchemaWithMeiliMethods;
      const query: FilterQuery<t.ISharedLink> = {
        user,
        ...activeExpirationFilter<t.ISharedLink>(),
      };

      if (pageParam) {
        if (sortDirection === 'desc') {
          query[sortBy] = { $lt: pageParam };
        } else {
          query[sortBy] = { $gt: pageParam };
        }
      }

      if (search && search.trim()) {
        try {
          const searchResults = await Conversation.meiliSearch(search, {
            filter: `user = "${user}"`,
          });

          if (!searchResults?.hits?.length) {
            return {
              links: [],
              nextCursor: undefined,
              hasNextPage: false,
            };
          }

          const conversationIds = searchResults.hits.map((hit) => hit.conversationId);
          query['conversationId'] = { $in: conversationIds };
        } catch (searchError) {
          logger.error('[getSharedLinks] Meilisearch error', {
            error: searchError instanceof Error ? searchError.message : 'Unknown error',
            user,
          });
          return {
            links: [],
            nextCursor: undefined,
            hasNextPage: false,
          };
        }
      }

      const sort: Record<string, 1 | -1> = {};
      sort[sortBy] = sortDirection === 'desc' ? -1 : 1;

      const sharedLinks = await SharedLink.find(query)
        .sort(sort)
        .limit(pageSize + 1)
        .select('-__v -user')
        .lean();

      const hasNextPage = sharedLinks.length > pageSize;
      const links = sharedLinks.slice(0, pageSize);

      const nextCursor = hasNextPage
        ? (links[links.length - 1][sortBy as keyof t.ISharedLink] as Date)
        : undefined;

      return {
        links: links.map((link) => ({
          shareId: link.shareId || '',
          title: link?.title || 'Untitled',
          createdAt: link.createdAt || new Date(),
          conversationId: link.conversationId,
        })),
        nextCursor,
        hasNextPage,
      };
    } catch (error) {
      logger.error('[getSharedLinks] Error getting shares', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user,
      });
      throw new ShareServiceError('Error getting shares', 'SHARES_FETCH_ERROR');
    }
  }

  /**
   * Delete all shared links for a user
   */
  async function deleteAllSharedLinks(
    user: string,
  ): Promise<t.DeleteAllSharesResult & { deletedIds: string[] }> {
    try {
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const links = await SharedLink.find({ user }).select('_id').lean();
      const ids = links.map((l) => l._id.toString());
      const result = await SharedLink.deleteMany({ user });
      return {
        message: 'All shared links deleted successfully',
        deletedCount: result.deletedCount,
        deletedIds: ids,
      };
    } catch (error) {
      logger.error('[deleteAllSharedLinks] Error deleting shared links', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user,
      });
      throw new ShareServiceError('Error deleting shared links', 'BULK_DELETE_ERROR');
    }
  }

  /**
   * Delete shared links by conversation ID
   */
  async function deleteConvoSharedLink(
    user: string,
    conversationId: string,
  ): Promise<t.DeleteAllSharesResult & { deletedIds: string[] }> {
    if (!user || !conversationId) {
      throw new ShareServiceError('Missing required parameters', 'INVALID_PARAMS');
    }

    try {
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const links = await SharedLink.find({ user, conversationId }).select('_id').lean();
      const ids = links.map((l) => l._id.toString());
      const result = await SharedLink.deleteMany({ user, conversationId });
      return {
        message: 'Shared links deleted successfully',
        deletedCount: result.deletedCount,
        deletedIds: ids,
      };
    } catch (error) {
      logger.error('[deleteConvoSharedLink] Error deleting shared links', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user,
        conversationId,
      });
      throw new ShareServiceError('Error deleting shared links', 'SHARE_DELETE_ERROR');
    }
  }

  /**
   * Create a new shared link for a conversation
   */
  async function createSharedLink(
    user: string,
    conversationId: string,
    targetMessageId?: string,
    expiredAt?: Date,
  ): Promise<t.CreateShareResult> {
    if (!user || !conversationId) {
      throw new ShareServiceError('Missing required parameters', 'INVALID_PARAMS');
    }
    try {
      const Message = mongoose.models.Message as SchemaWithMeiliMethods;
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const Conversation = mongoose.models.Conversation as SchemaWithMeiliMethods;

      const [existingShare, conversationMessages] = await Promise.all([
        SharedLink.findOne({
          conversationId,
          user,
          ...activeExpirationFilter<t.ISharedLink>(),
          ...(targetMessageId && { targetMessageId }),
        })
          .select('-_id -__v -user')
          .lean() as Promise<t.ISharedLink | null>,
        Message.find({ conversationId, user }).sort({ createdAt: 1 }).lean(),
      ]);

      if (existingShare) {
        logger.error('[createSharedLink] Share already exists', {
          user,
          conversationId,
          targetMessageId,
        });
        throw new ShareServiceError('Share already exists', 'SHARE_EXISTS');
      }

      const conversation = (await Conversation.findOne({ conversationId, user }).lean()) as {
        title?: string;
      } | null;

      // Check if user owns the conversation
      if (!conversation) {
        throw new ShareServiceError(
          'Conversation not found or access denied',
          'CONVERSATION_NOT_FOUND',
        );
      }

      // Check if there are any messages to share
      if (!conversationMessages || conversationMessages.length === 0) {
        throw new ShareServiceError('No messages to share', 'NO_MESSAGES');
      }

      const title = conversation.title || 'Untitled';

      const shareId = nanoid();
      const created = await SharedLink.create({
        shareId,
        conversationId,
        messages: conversationMessages,
        title,
        user,
        ...(targetMessageId && { targetMessageId }),
        ...(expiredAt && { expiredAt }),
      });

      return { _id: created._id.toString(), shareId, conversationId, targetMessageId };
    } catch (error) {
      if (error instanceof ShareServiceError) {
        throw error;
      }
      logger.error('[createSharedLink] Error creating shared link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user,
        conversationId,
        targetMessageId,
      });
      throw new ShareServiceError('Error creating shared link', 'SHARE_CREATE_ERROR');
    }
  }

  /**
   * Get a shared link for a conversation
   */
  async function getSharedLink(
    user: string,
    conversationId: string,
  ): Promise<t.GetShareLinkResult> {
    if (!user || !conversationId) {
      throw new ShareServiceError('Missing required parameters', 'INVALID_PARAMS');
    }

    try {
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const share = (await SharedLink.findOne({
        conversationId,
        user,
        ...activeExpirationFilter<t.ISharedLink>(),
      })
        .select('shareId targetMessageId _id')
        .sort({ updatedAt: -1 })
        .lean()) as {
        shareId?: string;
        targetMessageId?: string;
        _id?: import('mongoose').Types.ObjectId;
      } | null;

      if (!share) {
        return { shareId: null, success: false };
      }

      return {
        _id: share._id?.toString(),
        shareId: share.shareId || null,
        targetMessageId: share.targetMessageId,
        success: true,
      };
    } catch (error) {
      logger.error('[getSharedLink] Error getting shared link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user,
        conversationId,
      });
      throw new ShareServiceError('Error getting shared link', 'SHARE_FETCH_ERROR');
    }
  }

  /**
   * Update a shared link with new messages
   */
  async function updateSharedLink(
    user: string,
    shareId: string,
    targetMessageId?: string,
    expiredAt?: Date | null,
  ): Promise<t.UpdateShareResult> {
    if (!user || !shareId) {
      throw new ShareServiceError('Missing required parameters', 'INVALID_PARAMS');
    }

    try {
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const Message = mongoose.models.Message as SchemaWithMeiliMethods;
      const share = (await SharedLink.findOne({ shareId, user })
        .select('-_id -__v -user')
        .lean()) as t.ISharedLink | null;

      if (!share) {
        throw new ShareServiceError('Share not found', 'SHARE_NOT_FOUND');
      }

      const updatedMessages = await Message.find({ conversationId: share.conversationId, user })
        .sort({ createdAt: 1 })
        .lean();

      const newShareId = nanoid();
      const hasNewExpiration = expiredAt instanceof Date;
      const resolvedTargetMessageId = targetMessageId ?? share.targetMessageId;
      const update = {
        $set: {
          messages: updatedMessages,
          user,
          shareId: newShareId,
          ...(resolvedTargetMessageId && { targetMessageId: resolvedTargetMessageId }),
          ...(hasNewExpiration && { expiredAt }),
        },
        ...(expiredAt === null ? { $unset: { expiredAt: 1 } } : {}),
      };

      const updatedShare = (await SharedLink.findOneAndUpdate({ shareId, user }, update, {
        new: true,
        upsert: false,
        runValidators: true,
      }).lean()) as t.ISharedLink | null;

      if (!updatedShare) {
        throw new ShareServiceError('Share update failed', 'SHARE_UPDATE_ERROR');
      }

      anonymizeConvo(updatedShare);

      return {
        _id: updatedShare._id?.toString(),
        shareId: newShareId,
        conversationId: updatedShare.conversationId,
        targetMessageId: updatedShare.targetMessageId,
      };
    } catch (error) {
      logger.error('[updateSharedLink] Error updating shared link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user,
        shareId,
      });
      throw new ShareServiceError(
        error instanceof ShareServiceError ? error.message : 'Error updating shared link',
        error instanceof ShareServiceError ? error.code : 'SHARE_UPDATE_ERROR',
      );
    }
  }

  /**
   * Delete a shared link
   */
  async function deleteSharedLink(
    user: string,
    shareId: string,
  ): Promise<t.DeleteShareResult | null> {
    if (!user || !shareId) {
      throw new ShareServiceError('Missing required parameters', 'INVALID_PARAMS');
    }

    try {
      const SharedLink = mongoose.models.SharedLink as Model<t.ISharedLink>;
      const result = await SharedLink.findOneAndDelete({ shareId, user }).lean();

      if (!result) {
        return null;
      }

      return {
        _id: result._id?.toString(),
        success: true,
        shareId,
        message: 'Share deleted successfully',
      };
    } catch (error) {
      logger.error('[deleteSharedLink] Error deleting shared link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user,
        shareId,
      });
      throw new ShareServiceError('Error deleting shared link', 'SHARE_DELETE_ERROR');
    }
  }

  // Return all methods
  return {
    getSharedLink,
    getSharedLinks,
    createSharedLink,
    updateSharedLink,
    deleteSharedLink,
    getSharedMessages,
    deleteAllSharedLinks,
    deleteConvoSharedLink,
  };
}

export type ShareMethods = ReturnType<typeof createShareMethods>;
