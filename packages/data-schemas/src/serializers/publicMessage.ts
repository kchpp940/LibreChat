import { nanoid } from 'nanoid';
import { Constants, ContentTypes, ToolCallTypes, parseTextParts } from 'librechat-data-provider';
import type { IMessage } from '~/types/message';
import type { SharedFile } from '~/types/share';
import logger from '~/config/winston';
import {
  SerializerContext,
  type PublicMessage,
  type PublicContentPart,
  type PublicAttachmentSummary,
  type ToolCallSummary,
  type ArtifactSummary,
  type SerializerOptions,
  type ISerializationResult,
  type MessageFieldWhitelist,
} from './types';

const DEFAULT_MAX_TOOL_OUTPUT_LENGTH = 2000;
const DEFAULT_MAX_CONTENT_LENGTH = 10000;

const SENSITIVE_MESSAGE_FIELDS = new Set([
  '_id',
  '__v',
  'user',
  'tenantId',
  'endpoint',
  'conversationSignature',
  'clientId',
  'invocationId',
  'plugin',
  'plugins',
  'metadata',
  'contextMeta',
  'thread_id',
  '_meiliIndex',
  'summary',
  'summaryTokenCount',
  'feedback',
  'files',
  'attachments',
]);

const SENSITIVE_FILE_FIELDS = new Set([
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

const PUBLIC_MESSAGE_FIELDS: MessageFieldWhitelist = [
  'messageId',
  'conversationId',
  'parentMessageId',
  'sender',
  'text',
  'content',
  'iconURL',
  'model',
  'isCreatedByUser',
  'createdAt',
  'updatedAt',
  'tokenCount',
  'unfinished',
  'error',
  'finish_reason',
  'manualSkills',
  'alwaysAppliedSkills',
  'files',
  'attachments',
  'toolCalls',
  'artifacts',
];

const ALLOWED_CONTENT_TYPES = new Set([
  ContentTypes.TEXT,
  ContentTypes.TOOL_CALL,
  ContentTypes.IMAGE_FILE,
  ContentTypes.IMAGE_URL,
  ContentTypes.ERROR,
]);

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
const anonymizeMessageId = (id: string): string =>
  id === Constants.NO_PARENT ? id : memoizedAnonymizeId('msg')(id);

function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, maxLength) + '...',
    truncated: true,
  };
}

function sanitizeFile(value: unknown, options: SerializerOptions): SharedFile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const result: SharedFile = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (!SENSITIVE_FILE_FIELDS.has(key)) {
      result[key] = fieldValue;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeFiles(
  files: unknown,
  options: SerializerOptions,
  overrides: { conversationId?: string; messageId?: string } = {},
): SharedFile[] | undefined {
  if (!Array.isArray(files)) {
    return undefined;
  }

  const sanitized = files
    .map((file) => sanitizeFile(file, options))
    .filter((file): file is SharedFile => file != null)
    .map((file) => ({
      ...file,
      ...(overrides.conversationId !== undefined && { conversationId: overrides.conversationId }),
      ...(overrides.messageId !== undefined && { messageId: overrides.messageId }),
    }));

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeAttachment(attachment: unknown): PublicAttachmentSummary | null {
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) {
    return null;
  }

  const att = attachment as Record<string, unknown>;
  const summary: PublicAttachmentSummary = {};

  const allowedKeys = [
    'filename',
    'filepath',
    'type',
    'width',
    'height',
    'size',
    'bytes',
    'toolCallId',
    'messageId',
    'conversationId',
    'expiresAt',
  ];

  for (const key of allowedKeys) {
    if (att[key] !== undefined) {
      summary[key === 'bytes' ? 'size' : key] = att[key];
    }
  }

  const toolSpecificKeys = ['web_search', 'file_search', 'memory', 'ui_resources'];
  for (const key of toolSpecificKeys) {
    if (att[key] !== undefined) {
      summary[key] = att[key];
    }
  }

  return Object.keys(summary).length > 0 ? summary : null;
}

function sanitizeAttachments(
  attachments: unknown,
  overrides: { conversationId?: string; messageId?: string } = {},
): PublicAttachmentSummary[] | undefined {
  if (!Array.isArray(attachments)) {
    return undefined;
  }

  const sanitized = attachments
    .map(sanitizeAttachment)
    .filter((att): att is PublicAttachmentSummary => att != null)
    .map((att) => ({
      ...att,
      ...(overrides.conversationId !== undefined && { conversationId: overrides.conversationId }),
      ...(overrides.messageId !== undefined && { messageId: overrides.messageId }),
    }));

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeContentPart(
  part: unknown,
  options: SerializerOptions,
  warnings: string[],
): PublicContentPart | null {
  if (!part || typeof part !== 'object') {
    return null;
  }

  const contentPart = part as Record<string, unknown>;
  const type = contentPart.type as string;

  if (!ALLOWED_CONTENT_TYPES.has(type as ContentTypes)) {
    warnings.push(`Stripping content part of disallowed type: ${type}`);
    return null;
  }

  if (type === ContentTypes.TOOL_CALL) {
    const toolCall = contentPart.tool_call as Record<string, unknown> | undefined;
    if (!toolCall || typeof toolCall !== 'object') {
      warnings.push('Stripping malformed tool_call content part');
      return null;
    }

    const sanitizedToolCall: Record<string, unknown> = {
      id: toolCall.id,
      type: toolCall.type,
    };

    const toolType = toolCall.type as string;

    if (toolType === ToolCallTypes.FUNCTION && toolCall.function) {
      const func = toolCall.function as Record<string, unknown>;
      sanitizedToolCall.function = {
        name: func.name,
        arguments: func.arguments,
      };
    } else if (toolType === ToolCallTypes.CODE_INTERPRETER && toolCall.code_interpreter) {
      const codeInt = toolCall.code_interpreter as Record<string, unknown>;
      const sanitizedCodeInt: Record<string, unknown> = {
        input: codeInt.input,
      };
      sanitizedToolCall.code_interpreter = sanitizedCodeInt;

      if (codeInt.outputs && Array.isArray(codeInt.outputs)) {
        const maxLen = options.maxToolOutputLength ?? DEFAULT_MAX_TOOL_OUTPUT_LENGTH;
        const outputs = codeInt.outputs.map((output: unknown) => {
          if (output && typeof output === 'object') {
            const out = output as Record<string, unknown>;
            if (out.type === 'logs' && typeof out.logs === 'string') {
              const { text, truncated } = truncateText(out.logs, maxLen);
              if (truncated) {
                warnings.push(`Truncated code_interpreter logs from ${out.logs.length} to ${maxLen} chars`);
              }
              return { ...out, logs: text };
            }
          }
          return output;
        });
        sanitizedCodeInt.outputs = outputs;
      }
    } else if (toolType === ToolCallTypes.FILE_SEARCH || toolType === ToolCallTypes.RETRIEVAL) {
      if (toolCall[toolType]) {
        sanitizedToolCall[toolType] = {
          ranking_options: (toolCall[toolType] as Record<string, unknown>)?.ranking_options,
          filter: (toolCall[toolType] as Record<string, unknown>)?.filter,
        };
      }
    }

    return {
      type: ContentTypes.TOOL_CALL,
      tool_call: sanitizedToolCall as PublicContentPart['tool_call'],
    };
  }

  if (type === ContentTypes.TEXT) {
    const text = typeof contentPart.text === 'string' ? contentPart.text : '';
    if (options.truncateContent && options.context !== SerializerContext.DISPLAY) {
      const maxLen = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;
      const { text: truncatedText, truncated } = truncateText(text, maxLen);
      if (truncated) {
        warnings.push(`Truncated text content from ${text.length} to ${maxLen} chars`);
      }
      return { type: ContentTypes.TEXT, text: truncatedText };
    }
    return { type: ContentTypes.TEXT, text };
  }

  if (type === ContentTypes.IMAGE_FILE && contentPart.image_file) {
    const imgFile = contentPart.image_file as Record<string, unknown>;
    return {
      type: ContentTypes.IMAGE_FILE,
      image_file: {
        file_id: imgFile.file_id as string,
        detail: imgFile.detail as string | undefined,
      },
    };
  }

  if (type === ContentTypes.IMAGE_URL && contentPart.image_url) {
    const imgUrl = contentPart.image_url as Record<string, unknown>;
    return {
      type: ContentTypes.IMAGE_URL,
      image_url: {
        url: imgUrl.url as string,
        detail: imgUrl.detail as string | undefined,
      },
    };
  }

  if (type === ContentTypes.ERROR) {
    return {
      type: ContentTypes.ERROR,
      text: typeof contentPart.text === 'string' ? contentPart.text : '',
    };
  }

  return { type, ...contentPart } as PublicContentPart;
}

function sanitizeContent(
  content: unknown,
  options: SerializerOptions,
  warnings: string[],
): PublicContentPart[] | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const sanitized = content
    .map((part) => sanitizeContentPart(part, options, warnings))
    .filter((part): part is PublicContentPart => part != null);

  return sanitized.length > 0 ? sanitized : undefined;
}

function extractToolCallSummaries(
  content: PublicContentPart[] | undefined,
): ToolCallSummary[] | undefined {
  if (!content) {
    return undefined;
  }

  const summaries: ToolCallSummary[] = [];
  for (const part of content) {
    if (part.type === ContentTypes.TOOL_CALL && part.tool_call) {
      const tc = part.tool_call as Record<string, unknown>;
      const summary: ToolCallSummary = {
        id: tc.id as string,
        name: '',
        type: tc.type as string,
      };

      if (tc.type === ToolCallTypes.FUNCTION && tc.function) {
        const func = tc.function as Record<string, unknown>;
        summary.name = func.name as string;
        const args = func.arguments as string;
        if (args && args.length > 500) {
          summary.argumentsTruncated = true;
        }
      } else if (tc.type === ToolCallTypes.CODE_INTERPRETER) {
        summary.name = 'code_interpreter';
        const codeInt = tc.code_interpreter as Record<string, unknown> | undefined;
        const outputs = codeInt?.outputs;
        if (outputs && Array.isArray(outputs)) {
          summary.outputLength = JSON.stringify(outputs).length;
          summary.outputTruncated = summary.outputLength > DEFAULT_MAX_TOOL_OUTPUT_LENGTH;
        }
      } else if (tc.type === ToolCallTypes.FILE_SEARCH) {
        summary.name = 'file_search';
      } else if (tc.type === ToolCallTypes.RETRIEVAL) {
        summary.name = 'retrieval';
      }

      summaries.push(summary);
    }
  }

  return summaries.length > 0 ? summaries : undefined;
}

function extractArtifactSummaries(
  message: IMessage,
  warnings: string[],
): ArtifactSummary[] | undefined {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const artifacts = (metadata as Record<string, unknown>).artifacts;
  if (!artifacts || !Array.isArray(artifacts)) {
    return undefined;
  }

  const summaries: ArtifactSummary[] = [];
  for (const artifact of artifacts) {
    if (artifact && typeof artifact === 'object') {
      const a = artifact as Record<string, unknown>;
      summaries.push({
        id: a.id as string,
        type: (a.type as string) ?? 'unknown',
        title: a.title as string | undefined,
        size: typeof a.size === 'number' ? a.size : undefined,
      });
    } else {
      warnings.push('Skipping malformed artifact in metadata');
    }
  }

  return summaries.length > 0 ? summaries : undefined;
}

function anonymizeModel(model?: string): string | undefined {
  if (!model?.startsWith('asst_')) {
    return undefined;
  }
  return anonymizeAssistantId(model);
}

function serializeMessage(
  message: IMessage,
  options: SerializerOptions = {},
): ISerializationResult {
  const warnings: string[] = [];
  const strippedFields: string[] = [];
  const idMapping = options.idMapping ?? new Map<string, string>();

  const newMessageId = options.anonymizeIds
    ? anonymizeMessageId(message.messageId)
    : message.messageId;
  if (options.anonymizeIds) {
    idMapping.set(message.messageId, newMessageId);
  }

  const newConvoId = options.anonymizeIds
    ? anonymizeConvoId(message.conversationId)
    : message.conversationId;

  const parentMessageId = message.parentMessageId
    ? options.anonymizeIds
      ? idMapping.get(message.parentMessageId) ?? anonymizeMessageId(message.parentMessageId)
      : message.parentMessageId
    : null;

  const model = options.includeSensitiveModel
    ? message.model
    : anonymizeModel(message.model);

  const attachments = sanitizeAttachments(message.attachments, {
    conversationId: options.anonymizeIds ? newConvoId : undefined,
    messageId: options.anonymizeIds ? newMessageId : undefined,
  });

  const files = sanitizeFiles(message.files, options, {
    conversationId: options.anonymizeIds ? newConvoId : undefined,
    messageId: options.anonymizeIds ? newMessageId : undefined,
  });

  const content = sanitizeContent(message.content, options, warnings);

  const toolCalls = extractToolCallSummaries(content);
  const artifacts = extractArtifactSummaries(message, warnings);

  let text = message.text;
  if (!text && content && options.context !== SerializerContext.DISPLAY) {
    text = parseTextParts(content as unknown as Parameters<typeof parseTextParts>[0]);
  }

  if (options.truncateContent && text && options.context !== SerializerContext.DISPLAY) {
    const maxLen = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;
    const { text: truncatedText, truncated } = truncateText(text, maxLen);
    if (truncated) {
      warnings.push(`Truncated message text from ${text.length} to ${maxLen} chars`);
    }
    text = truncatedText;
  }

  const publicMessage: PublicMessage = {
    messageId: newMessageId,
    conversationId: newConvoId,
    parentMessageId,
    sender: message.sender,
    text,
    content: options.context === SerializerContext.SEARCH ? undefined : content,
    iconURL: message.iconURL,
    model,
    isCreatedByUser: message.isCreatedByUser,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    tokenCount: message.tokenCount,
    unfinished: message.unfinished,
    error: message.error,
    finish_reason: message.finish_reason,
    manualSkills: message.manualSkills,
    alwaysAppliedSkills: message.alwaysAppliedSkills,
    files,
    attachments,
    toolCalls: options.context === SerializerContext.SEARCH ? toolCalls : undefined,
    artifacts,
  };

  const messageKeys = Object.keys(message.toObject ? message.toObject() : message);
  for (const key of messageKeys) {
    if (SENSITIVE_MESSAGE_FIELDS.has(key) && !PUBLIC_MESSAGE_FIELDS.includes(key as keyof PublicMessage)) {
      strippedFields.push(key);
    }
  }

  return {
    message: publicMessage,
    warnings,
    strippedFields,
  };
}

function serializeMessages(
  messages: IMessage[],
  options: SerializerOptions = {},
): { messages: PublicMessage[]; warnings: string[]; strippedFields: string[] } {
  const idMapping = new Map<string, string>();
  const allWarnings: string[] = [];
  const allStrippedFields = new Set<string>();

  const serialized = messages.map((msg) => {
    const result = serializeMessage(msg, {
      ...options,
      idMapping,
    });
    allWarnings.push(...result.warnings.map((w: string) => `[${msg.messageId}] ${w}`));
    result.strippedFields.forEach((f: string) => allStrippedFields.add(f));
    return result.message;
  });

  return {
    messages: serialized,
    warnings: allWarnings,
    strippedFields: Array.from(allStrippedFields),
  };
}

function forShare(messages: IMessage[], conversationId: string): {
  messages: PublicMessage[];
  conversationId: string;
  warnings: string[];
} {
  const newConvoId = anonymizeConvoId(conversationId);
  const result = serializeMessages(messages, {
    context: SerializerContext.SHARE,
    anonymizeIds: true,
    maxToolOutputLength: DEFAULT_MAX_TOOL_OUTPUT_LENGTH,
  });

  return {
    messages: result.messages.map((m) => ({ ...m, conversationId: newConvoId })),
    conversationId: newConvoId,
    warnings: result.warnings,
  };
}

function forSearch(message: IMessage): {
  text: string;
  toolCalls?: ToolCallSummary[];
  warnings: string[];
} {
  const result = serializeMessage(message, {
    context: SerializerContext.SEARCH,
    truncateContent: true,
    maxContentLength: 5000,
  });

  if (result.warnings.length > 0) {
    logger.debug('[publicMessageSerializer] Search serialization warnings:', {
      messageId: message.messageId,
      warnings: result.warnings,
    });
  }

  return {
    text: result.message.text ?? '',
    toolCalls: result.message.toolCalls,
    warnings: result.warnings,
  };
}

function forExport(message: IMessage): {
  message: PublicMessage;
  warnings: string[];
} {
  const result = serializeMessage(message, {
    context: SerializerContext.EXPORT,
    includeSensitiveModel: false,
  });

  return {
    message: result.message,
    warnings: result.warnings,
  };
}

function forDisplay(message: IMessage): {
  message: PublicMessage;
  warnings: string[];
} {
  const result = serializeMessage(message, {
    context: SerializerContext.DISPLAY,
    truncateContent: false,
  });

  return {
    message: result.message,
    warnings: result.warnings,
  };
}

interface PublicMessageSerializerAPI {
  serializeMessage: typeof serializeMessage;
  serializeMessages: typeof serializeMessages;
  forShare: typeof forShare;
  forSearch: typeof forSearch;
  forExport: typeof forExport;
  forDisplay: typeof forDisplay;
  SENSITIVE_MESSAGE_FIELDS: Set<string>;
  SENSITIVE_FILE_FIELDS: Set<string>;
  PUBLIC_MESSAGE_FIELDS: MessageFieldWhitelist;
  ALLOWED_CONTENT_TYPES: Set<string>;
  sanitizeFile: typeof sanitizeFile;
  sanitizeFiles: typeof sanitizeFiles;
  sanitizeAttachment: typeof sanitizeAttachment;
  sanitizeAttachments: typeof sanitizeAttachments;
  sanitizeContent: typeof sanitizeContent;
  sanitizeContentPart: typeof sanitizeContentPart;
  truncateText: typeof truncateText;
  anonymizeMessageId: (id: string) => string;
  anonymizeConvoId: (id: string) => string;
  anonymizeAssistantId: (id: string) => string;
  anonymizeModel: (model?: string) => string | undefined;
}

export const publicMessageSerializer: PublicMessageSerializerAPI = {
  serializeMessage: serializeMessage,
  serializeMessages: serializeMessages,
  forShare: forShare,
  forSearch: forSearch,
  forExport: forExport,
  forDisplay: forDisplay,
  SENSITIVE_MESSAGE_FIELDS: SENSITIVE_MESSAGE_FIELDS,
  SENSITIVE_FILE_FIELDS: SENSITIVE_FILE_FIELDS,
  PUBLIC_MESSAGE_FIELDS: PUBLIC_MESSAGE_FIELDS,
  ALLOWED_CONTENT_TYPES: ALLOWED_CONTENT_TYPES,
  sanitizeFile: sanitizeFile,
  sanitizeFiles: sanitizeFiles,
  sanitizeAttachment: sanitizeAttachment,
  sanitizeAttachments: sanitizeAttachments,
  sanitizeContent: sanitizeContent,
  sanitizeContentPart: sanitizeContentPart,
  truncateText: truncateText,
  anonymizeMessageId: anonymizeMessageId,
  anonymizeConvoId: anonymizeConvoId,
  anonymizeAssistantId: anonymizeAssistantId,
  anonymizeModel: anonymizeModel,
};

export default publicMessageSerializer;
