import type { IMessage } from './message';
import type { TAttachment, TMessageContentParts } from 'librechat-data-provider';

export enum PublicMessageContext {
  SHARE = 'share',
  SEARCH = 'search',
  EXPORT = 'export',
  DISPLAY = 'display',
}

export interface PublicMessageBase {
  messageId: string;
  parentMessageId: string | null;
  conversationId: string;
  sender?: string;
  text?: string;
  content?: Array<Record<string, unknown>>;
  iconURL?: string;
  isCreatedByUser: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  tokenCount?: number;
  unfinished?: boolean;
  error?: boolean;
  finish_reason?: string;
  manualSkills?: string[];
  alwaysAppliedSkills?: string[];
  model?: string;
}

export interface PublicFile {
  file_id?: string;
  filename?: string;
  filepath?: string;
  type?: string;
  width?: number;
  height?: number;
  bytes?: number;
  expiresAt?: Date | number;
  messageId?: string;
  conversationId?: string;
  toolCallId?: string;
  [key: string]: unknown;
}

export interface PublicToolCall {
  id?: string;
  type?: string;
  name?: string;
  args?: string;
  output?: string;
  outputTruncated?: boolean;
  attachments?: PublicFile[];
}

export interface PublicArtifactReference {
  artifactId?: string;
  title?: string;
  type?: string;
  language?: string;
}

export interface PublicMessage extends PublicMessageBase {
  files?: PublicFile[];
  attachments?: PublicFile[];
  toolCalls?: PublicToolCall[];
  artifacts?: PublicArtifactReference[];
}

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
  context: PublicMessageContext;
  anonymizeIds?: boolean;
  idMap?: Map<string, string>;
  contentPartOptions?: ContentPartCleanOptions;
  fileOptions?: FileSummaryOptions;
  maxToolOutputLength?: number;
}

export interface SerializeMessageResult {
  message: PublicMessage;
  idMap: Map<string, string>;
}

export const PUBLIC_MESSAGE_FIELDS: ReadonlyArray<keyof PublicMessageBase> = [
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
