import { nanoid } from 'nanoid';
import { Constants } from 'librechat-data-provider';
import logger from '~/config/winston';
import type * as t from '~/types';
import {
  PublicMessageContext,
  PUBLIC_MESSAGE_FIELDS,
  SENSITIVE_MESSAGE_FIELDS,
  SENSITIVE_FILE_FIELDS,
  DEFAULT_CONTENT_PART_OPTIONS,
  DEFAULT_FILE_OPTIONS,
  DEFAULT_MAX_TOOL_OUTPUT_LENGTH,
  type PublicMessage,
  type PublicFile,
  type PublicToolCall,
  type PublicArtifactReference,
  type ContentPartCleanOptions,
  type FileSummaryOptions,
  type SerializeOptions,
  type SerializeMessageResult,
  type IMessageLike,
} from '~/types/publicMessage';

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

function anonymizeMessageId(id: string, idMap?: Map<string, string>): string {
  if (id === Constants.NO_PARENT) {
    return id;
  }
  if (idMap?.has(id)) {
    return idMap.get(id) as string;
  }
  const newId = `msg_${nanoid()}`;
  idMap?.set(id, newId);
  return newId;
}

function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  return {
    text: text.substring(0, maxLength) + '...',
    truncated: true,
  };
}

function sanitizeFile(
  file: unknown,
  options: FileSummaryOptions = DEFAULT_FILE_OPTIONS,
): PublicFile | null {
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    return null;
  }

  const result: PublicFile = {};
  const fileRecord = file as Record<string, unknown>;

  for (const [key, value] of Object.entries(fileRecord)) {
    if (!SENSITIVE_FILE_FIELDS.has(key)) {
      result[key] = value;
    }
  }

  if (!options.includeFileIds && result.file_id) {
    delete result.file_id;
  }

  if (!options.includeDimensions) {
    delete result.width;
    delete result.height;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeFiles(
  files: unknown,
  options: FileSummaryOptions = DEFAULT_FILE_OPTIONS,
  overrideIds?: { messageId?: string; conversationId?: string },
): PublicFile[] | undefined {
  if (!Array.isArray(files)) {
    return undefined;
  }

  const limitedFiles = files.slice(0, options.maxFiles);
  const sanitized = limitedFiles
    .map((file) => sanitizeFile(file, options))
    .filter((file): file is PublicFile => file != null)
    .map((file) => {
      if (overrideIds) {
        return {
          ...file,
          ...(overrideIds.conversationId !== undefined && { conversationId: overrideIds.conversationId }),
          ...(overrideIds.messageId !== undefined && { messageId: overrideIds.messageId }),
        };
      }
      return file;
    });

  return sanitized.length > 0 ? sanitized : undefined;
}

function anonymizeModel(model?: string): string | undefined {
  if (!model?.startsWith('asst_')) {
    return undefined;
  }
  return anonymizeAssistantId(model);
}

function cleanContentPart(
  part: unknown,
  options: ContentPartCleanOptions = DEFAULT_CONTENT_PART_OPTIONS,
): Record<string, unknown> | null {
  if (!part || typeof part !== 'object' || Array.isArray(part)) {
    return null;
  }

  const partObj = part as Record<string, unknown>;
  const type = partObj.type as string | undefined;
  const result: Record<string, unknown> = {};

  switch (type) {
    case 'text': {
      result.type = 'text';
      if (typeof partObj.text === 'string') {
        result.text = partObj.text;
      }
      if (Array.isArray(partObj.tool_call_ids)) {
        result.tool_call_ids = partObj.tool_call_ids;
      }
      break;
    }
    case 'think': {
      if (options.keepThinkContent && typeof partObj.think === 'string') {
        result.type = 'think';
        result.think = partObj.think;
      } else {
        return null;
      }
      break;
    }
    case 'error': {
      result.type = 'error';
      if (options.keepErrorDetails) {
        if (typeof partObj.error === 'string') {
          result.error = partObj.error;
        }
        if (typeof partObj.text === 'string') {
          result.text = partObj.text;
        }
      } else {
        result.error = 'An error occurred';
      }
      break;
    }
    case 'tool_call': {
      const toolCall = partObj.tool_call as Record<string, unknown> | undefined;
      if (!toolCall) {
        return null;
      }
      result.type = 'tool_call';
      result.tool_call = {
        id: toolCall.id,
        type: toolCall.type,
        name: toolCall.name,
        args: toolCall.args,
      };

      if (typeof toolCall.output === 'string') {
        const { text, truncated } = truncateText(
          toolCall.output,
          options.maxToolOutputLength ?? DEFAULT_MAX_TOOL_OUTPUT_LENGTH,
        );
        (result.tool_call as Record<string, unknown>).output = text;
        if (truncated) {
          (result.tool_call as Record<string, unknown>).outputTruncated = true;
        }
      }
      break;
    }
    case 'image_file': {
      const imageFile = partObj.image_file as Record<string, unknown> | undefined;
      if (!imageFile) {
        return null;
      }
      result.type = 'image_file';
      result.image_file = {
        file_id: imageFile.file_id,
        detail: imageFile.detail,
      };
      break;
    }
    case 'image_url': {
      const imageUrl = partObj.image_url as Record<string, unknown> | undefined;
      if (!imageUrl) {
        return null;
      }
      result.type = 'image_url';
      result.image_url = {
        url: imageUrl.url,
        detail: imageUrl.detail,
      };
      break;
    }
    case 'video_url': {
      const videoUrl = partObj.video_url as Record<string, unknown> | undefined;
      if (!videoUrl) {
        return null;
      }
      result.type = 'video_url';
      result.video_url = {
        url: videoUrl.url,
      };
      break;
    }
    case 'input_audio': {
      const inputAudio = partObj.input_audio as Record<string, unknown> | undefined;
      if (!inputAudio) {
        return null;
      }
      result.type = 'input_audio';
      result.input_audio = {
        data: inputAudio.data,
        format: inputAudio.format,
      };
      break;
    }
    case 'summary': {
      result.type = 'summary';
      if (typeof partObj.summary === 'string') {
        result.summary = partObj.summary;
      }
      break;
    }
    default:
      return null;
  }

  return result;
}

function cleanContentParts(
  content: unknown,
  options: ContentPartCleanOptions = DEFAULT_CONTENT_PART_OPTIONS,
): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const cleaned = content
    .map((part) => cleanContentPart(part, options))
    .filter((part): part is Record<string, unknown> => part != null);

  return cleaned.length > 0 ? cleaned : undefined;
}

function extractToolCalls(
  message: IMessageLike,
  maxOutputLength: number = DEFAULT_MAX_TOOL_OUTPUT_LENGTH,
): PublicToolCall[] | undefined {
  const content = message.content;
  if (!Array.isArray(content)) {
    return undefined;
  }

  const toolCalls: PublicToolCall[] = [];
  for (const part of content) {
    if (!part || typeof part !== 'object' || Array.isArray(part)) {
      continue;
    }
    const partObj = part as Record<string, unknown>;
    if (partObj.type === 'tool_call' && partObj.tool_call) {
      const tc = partObj.tool_call as Record<string, unknown>;
      const toolCall: PublicToolCall = {
        id: tc.id as string | undefined,
        type: tc.type as string | undefined,
        name: tc.name as string | undefined,
        args: tc.args as string | undefined,
      };

      if (typeof tc.output === 'string') {
        const { text, truncated } = truncateText(tc.output, maxOutputLength);
        toolCall.output = text;
        toolCall.outputTruncated = truncated;
      }

      if (Array.isArray(tc.attachments)) {
        toolCall.attachments = tc.attachments
          .map((a) => sanitizeFile(a))
          .filter((f): f is PublicFile => f != null);
      }

      toolCalls.push(toolCall);
    }
  }

  return toolCalls.length > 0 ? toolCalls : undefined;
}

function extractArtifacts(
  message: IMessageLike,
): PublicArtifactReference[] | undefined {
  const artifacts = message.artifacts;
  if (!Array.isArray(artifacts)) {
    return undefined;
  }

  const references: PublicArtifactReference[] = [];
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      continue;
    }
    const a = artifact as Record<string, unknown>;
    references.push({
      artifactId: a.id as string | undefined ?? a.artifactId as string | undefined,
      title: a.title as string | undefined,
      type: a.type as string | undefined,
      language: a.language as string | undefined,
    });
  }

  return references.length > 0 ? references : undefined;
}

function serializeSingleMessage(
  message: IMessageLike,
  options: SerializeOptions,
): SerializeMessageResult {
  const {
    context,
    anonymizeIds = context === PublicMessageContext.SHARE,
    idMap = new Map<string, string>(),
    contentPartOptions = {},
    fileOptions = {},
    maxToolOutputLength = DEFAULT_MAX_TOOL_OUTPUT_LENGTH,
  } = options;

  const mergedContentOptions: Required<ContentPartCleanOptions> = {
    ...DEFAULT_CONTENT_PART_OPTIONS,
    ...contentPartOptions,
  };

  const mergedFileOptions: Required<FileSummaryOptions> = {
    ...DEFAULT_FILE_OPTIONS,
    ...fileOptions,
  };

  let newMessageId = message.messageId ?? '';
  let newConversationId = message.conversationId ?? '';
  let newParentMessageId = message.parentMessageId ?? null;

  if (anonymizeIds) {
    newConversationId = anonymizeConvoId(message.conversationId ?? '');
    newMessageId = anonymizeMessageId(message.messageId ?? '', idMap);
    if (newParentMessageId) {
      newParentMessageId = anonymizeMessageId(newParentMessageId, idMap);
    }
  }

  const overrideIds = anonymizeIds
    ? { messageId: newMessageId, conversationId: newConversationId }
    : undefined;

  const publicMessage: PublicMessage = {
    messageId: newMessageId,
    parentMessageId: newParentMessageId,
    conversationId: newConversationId,
    isCreatedByUser: message.isCreatedByUser ?? false,
  };

  for (const field of PUBLIC_MESSAGE_FIELDS) {
    if (field === 'messageId' || field === 'parentMessageId' || field === 'conversationId' || field === 'isCreatedByUser') {
      continue;
    }
    const value = message[field];
    if (value !== undefined && value !== null) {
      (publicMessage as unknown as Record<string, unknown>)[field] = value;
    }
  }

  if (context === PublicMessageContext.SHARE) {
    const model = anonymizeModel(message.model);
    if (model) {
      publicMessage.model = model;
    }
  } else if (message.model) {
    publicMessage.model = message.model;
  }

  if (context === PublicMessageContext.SEARCH) {
    if (typeof message.text === 'string' && message.text.length > 500) {
      publicMessage.text = message.text.substring(0, 500) + '...';
    }
    if (Array.isArray(message.content)) {
      publicMessage.content = cleanContentParts(message.content, {
        ...mergedContentOptions,
        maxToolOutputLength: 200,
      });
    }
  } else {
    publicMessage.content = cleanContentParts(message.content, mergedContentOptions);
  }

  publicMessage.files = sanitizeFiles(message.files, mergedFileOptions, overrideIds);
  publicMessage.attachments = sanitizeFiles(message.attachments, mergedFileOptions, overrideIds);

  if (context === PublicMessageContext.DISPLAY || context === PublicMessageContext.EXPORT) {
    publicMessage.toolCalls = extractToolCalls(message, maxToolOutputLength);
    publicMessage.artifacts = extractArtifacts(message);
  }

  for (const key of Object.keys(publicMessage)) {
    const value = (publicMessage as unknown as Record<string, unknown>)[key];
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      delete (publicMessage as unknown as Record<string, unknown>)[key];
    }
  }

  return {
    message: publicMessage,
    idMap,
  };
}

export function serializeMessage(
  message: IMessageLike,
  options: SerializeOptions,
): SerializeMessageResult {
  try {
    return serializeSingleMessage(message, options);
  } catch (error) {
    logger.error('[serializeMessage] Error serializing message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: message.messageId,
      context: options.context,
    });
    throw error;
  }
}

export function serializeMessages(
  messages: IMessageLike[],
  options: SerializeOptions,
): { messages: PublicMessage[]; idMap: Map<string, string> } {
  if (!Array.isArray(messages)) {
    return { messages: [], idMap: new Map() };
  }

  const idMap = options.idMap ?? new Map<string, string>();
  const results: PublicMessage[] = [];

  for (const message of messages) {
    try {
      const result = serializeSingleMessage(message, {
        ...options,
        idMap,
      });
      results.push(result.message);
    } catch (error) {
      logger.error('[serializeMessages] Error serializing message, skipping', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.messageId,
        context: options.context,
      });
    }
  }

  return {
    messages: results,
    idMap,
  };
}

export function serializeForShare(
  messages: IMessageLike[],
  conversationId: string,
): { messages: PublicMessage[]; conversationId: string; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const newConvoId = anonymizeConvoId(conversationId);

  const result = serializeMessages(messages, {
    context: PublicMessageContext.SHARE,
    anonymizeIds: true,
    idMap,
    contentPartOptions: {
      keepThinkContent: false,
      keepErrorDetails: false,
      maxToolOutputLength: 1000,
    },
    fileOptions: {
      includeFileIds: true,
      includeDimensions: true,
      maxFiles: 50,
    },
  });

  return {
    messages: result.messages,
    conversationId: newConvoId,
    idMap: result.idMap,
  };
}

export function serializeForSearch(
  message: IMessageLike,
): PublicMessage {
  const result = serializeMessage(message, {
    context: PublicMessageContext.SEARCH,
    anonymizeIds: false,
    contentPartOptions: {
      keepThinkContent: false,
      keepErrorDetails: false,
      maxToolOutputLength: 200,
    },
    fileOptions: {
      includeFileIds: false,
      includeDimensions: false,
      maxFiles: 5,
    },
  });
  return result.message;
}

export function serializeForExport(
  messages: IMessageLike[],
): { messages: PublicMessage[]; idMap: Map<string, string> } {
  return serializeMessages(messages, {
    context: PublicMessageContext.EXPORT,
    anonymizeIds: false,
    contentPartOptions: {
      keepThinkContent: true,
      keepErrorDetails: true,
      maxToolOutputLength: 5000,
    },
    fileOptions: {
      includeFileIds: true,
      includeDimensions: true,
      maxFiles: 100,
    },
  });
}

export function serializeForDisplay(
  message: IMessageLike,
): PublicMessage {
  const result = serializeMessage(message, {
    context: PublicMessageContext.DISPLAY,
    anonymizeIds: false,
    contentPartOptions: {
      keepThinkContent: true,
      keepErrorDetails: true,
      maxToolOutputLength: 2000,
    },
    fileOptions: {
      includeFileIds: true,
      includeDimensions: true,
      maxFiles: 50,
    },
  });
  return result.message;
}

export function assertIsPublicMessage(
  value: unknown,
): asserts value is PublicMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid PublicMessage: not an object');
  }

  const msg = value as Record<string, unknown>;

  if (typeof msg.messageId !== 'string') {
    throw new Error('Invalid PublicMessage: missing messageId');
  }

  if (typeof msg.isCreatedByUser !== 'boolean') {
    throw new Error('Invalid PublicMessage: missing isCreatedByUser');
  }

  if (typeof msg.conversationId !== 'string') {
    throw new Error('Invalid PublicMessage: missing conversationId');
  }

  for (const sensitiveField of SENSITIVE_MESSAGE_FIELDS) {
    if (sensitiveField in msg) {
      throw new Error(`Invalid PublicMessage: contains sensitive field '${sensitiveField}'`);
    }
  }
}

export function isPublicMessage(value: unknown): value is PublicMessage {
  try {
    assertIsPublicMessage(value);
    return true;
  } catch {
    return false;
  }
}

export type PublicMessageSerializer = {
  serializeMessage: typeof serializeMessage;
  serializeMessages: typeof serializeMessages;
  serializeForShare: typeof serializeForShare;
  serializeForSearch: typeof serializeForSearch;
  serializeForExport: typeof serializeForExport;
  serializeForDisplay: typeof serializeForDisplay;
  assertIsPublicMessage: typeof assertIsPublicMessage;
  isPublicMessage: typeof isPublicMessage;
  sanitizeFile: typeof sanitizeFile;
  sanitizeFiles: typeof sanitizeFiles;
  cleanContentPart: typeof cleanContentPart;
  cleanContentParts: typeof cleanContentParts;
  truncateText: typeof truncateText;
};

export function createPublicMessageSerializer(): PublicMessageSerializer {
  return {
    serializeMessage,
    serializeMessages,
    serializeForShare,
    serializeForSearch,
    serializeForExport,
    serializeForDisplay,
    assertIsPublicMessage,
    isPublicMessage,
    sanitizeFile,
    sanitizeFiles,
    cleanContentPart,
    cleanContentParts,
    truncateText,
  };
}

export default createPublicMessageSerializer;
