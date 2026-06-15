import type { IMessage } from './message';
import type { TAttachment, TMessageContentParts } from 'librechat-data-provider';
/* Re-export public types from librechat-data-provider as the single source of truth.
 * This ensures frontend and backend share the exact same type definitions
 * and prevents drift between the two codebases. */
export {
  PublicMessageContext,
  PublicMessageBase,
  PublicFile,
  PublicToolCall,
  PublicArtifactReference,
  PublicMessage,
} from 'librechat-data-provider';
import type {
  PublicMessageBase as DataProviderPublicMessageBase,
  PublicFile as DataProviderPublicFile,
} from 'librechat-data-provider';

/* Internal serializer-only types, not needed by frontend consumers */
export interface ContentPartCleanOptions {
  maxToolOutputLength?: number;
  keepThinkContent?: boolean;
  keepErrorDetails?: boolean;
}

export interface FileSummaryOptions {
  includeFileIds?: boolean;
  includeDimensions?: boolean;
  maxFiles?: number;
}

export interface SerializeOptions {
  context: import('librechat-data-provider').PublicMessageContext;
  anonymizeIds?: boolean;
  idMap?: Map<string, string>;
  contentPartOptions?: ContentPartCleanOptions;
  fileOptions?: FileSummaryOptions;
  maxToolOutputLength?: number;
}

export interface SerializeMessageResult {
  message: import('librechat-data-provider').PublicMessage;
  idMap: Map<string, string>;
}

export const PUBLIC_MESSAGE_FIELDS: ReadonlyArray<keyof DataProviderPublicMessageBase> = [
  'messageId',
  'parentMessageId',
  'conversationId',
  'sender',
  'text',
  'content',
  'iconURL',
  'isCreatedByUser',
  'createdAt',
  'updatedAt',
  'tokenCount',
  'unfinished',
  'error',
  'finish_reason',
  'manualSkills',
  'alwaysAppliedSkills',
] as const;

export const SENSITIVE_MESSAGE_FIELDS: ReadonlySet<string> = new Set([
  '_id',
  '__v',
  'user',
  'tenantId',
  'endpoint',
  'conversationSignature',
  'clientId',
  'invocationId',
  'thread_id',
  'plugin',
  'plugins',
  'metadata',
  'contextMeta',
  '_meiliIndex',
  'summary',
  'summaryTokenCount',
  'isTemporary',
  'feedback',
  'files',
  'attachments',
  'expiredAt',
  'addedConvo',
]);

export const SENSITIVE_FILE_FIELDS: ReadonlySet<string> = new Set([
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
  'text',
  'textFormat',
  'status',
  'previewError',
  'previewRevision',
  'model',
  'object',
  'expiresAt',
]);

export const DEFAULT_CONTENT_PART_OPTIONS: Required<ContentPartCleanOptions> = {
  maxToolOutputLength: 1000,
  keepThinkContent: false,
  keepErrorDetails: false,
};

export const DEFAULT_FILE_OPTIONS: Required<FileSummaryOptions> = {
  includeFileIds: true,
  includeDimensions: true,
  maxFiles: 50,
};

export const DEFAULT_MAX_TOOL_OUTPUT_LENGTH = 1000;

export type IMessageLike = Partial<IMessage> & Record<string, unknown>;
