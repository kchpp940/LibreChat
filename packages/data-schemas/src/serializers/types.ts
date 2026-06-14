import type { IMessage } from '~/types/message';
import type { SharedFile } from '~/types/share';

export enum SerializerContext {
  SHARE = 'share',
  SEARCH = 'search',
  EXPORT = 'export',
  DISPLAY = 'display',
}

export interface ContentPartBase {
  type: string;
  [key: string]: unknown;
}

export interface TextContentPart extends ContentPartBase {
  type: 'text';
  text: string;
}

export interface ToolCallContentPart extends ContentPartBase {
  type: 'tool_call';
  tool_call: {
    id: string;
    type: string;
    function?: {
      name: string;
      arguments: string;
    };
    code_interpreter?: {
      input?: string;
      outputs?: unknown[];
    };
    [key: string]: unknown;
  };
}

export interface ImageFileContentPart extends ContentPartBase {
  type: 'image_file';
  image_file: {
    file_id: string;
    detail?: string;
  };
}

export interface ImageUrlContentPart extends ContentPartBase {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: string;
  };
}

export type PublicContentPart =
  | TextContentPart
  | ToolCallContentPart
  | ImageFileContentPart
  | ImageUrlContentPart
  | ContentPartBase;

export interface PublicAttachmentSummary {
  filename?: string;
  filepath?: string;
  type?: string;
  width?: number;
  height?: number;
  size?: number;
  toolCallId?: string;
  messageId?: string;
  conversationId?: string;
  [key: string]: unknown;
}

export interface ToolCallSummary {
  id: string;
  name: string;
  type: string;
  argumentsTruncated?: boolean;
  outputTruncated?: boolean;
  outputLength?: number;
}

export interface ArtifactSummary {
  id: string;
  type: string;
  title?: string;
  size?: number;
}

export interface PublicMessage {
  messageId: string;
  conversationId: string;
  parentMessageId?: string | null;
  sender?: string;
  text?: string;
  content?: PublicContentPart[];
  iconURL?: string;
  model?: string;
  isCreatedByUser: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  tokenCount?: number;
  unfinished?: boolean;
  error?: boolean;
  finish_reason?: string;
  manualSkills?: string[];
  alwaysAppliedSkills?: string[];
  files?: SharedFile[];
  attachments?: PublicAttachmentSummary[];
  toolCalls?: ToolCallSummary[];
  artifacts?: ArtifactSummary[];
}

export interface SerializerOptions {
  context?: SerializerContext;
  anonymizeIds?: boolean;
  idMapping?: Map<string, string>;
  maxToolOutputLength?: number;
  includeSensitiveModel?: boolean;
  truncateContent?: boolean;
  maxContentLength?: number;
}

export type MessageFieldWhitelist = Array<keyof PublicMessage | (string & {})>;

export interface ISerializationResult {
  message: PublicMessage;
  warnings: string[];
  strippedFields: string[];
}
