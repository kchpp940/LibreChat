import type { IMessage } from '~/types/message';

export enum SerializerContext {
  SHARE = 'share',
  SEARCH = 'search',
  EXPORT = 'export',
  DISPLAY = 'display',
}

export interface PublicContentPartBase {
  type: string;
  [key: string]: unknown;
}

export interface PublicTextContentPart extends PublicContentPartBase {
  type: 'text';
  text: string;
}

export interface PublicToolCallContentPart extends PublicContentPartBase {
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

export interface PublicImageFileContentPart extends PublicContentPartBase {
  type: 'image_file';
  image_file: {
    file_id: string;
    detail?: string;
  };
}

export interface PublicImageUrlContentPart extends PublicContentPartBase {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: string;
  };
}

export type PublicContentPart =
  | PublicTextContentPart
  | PublicToolCallContentPart
  | PublicImageFileContentPart
  | PublicImageUrlContentPart
  | PublicContentPartBase;

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

/**
 * @summary 经过 publicMessageSerializer 统一脱敏和白名单过滤后的公开消息视图
 * - **禁止手动构造**：必须由 publicMessageSerializer.forShare / forSearch / forExport / forDisplay 输出
 * - **禁止用于运行时**：不能用于登录态聊天主消息接口，那些接口必须返回完整 TMessage
 * - **禁止直接读取原始 message 字段**：消费方只能使用本接口列出的字段
 */
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
  createdAt?: Date | string;
  updatedAt?: Date | string;
  tokenCount?: number;
  unfinished?: boolean;
  error?: boolean;
  finish_reason?: string;
  manualSkills?: string[];
  alwaysAppliedSkills?: string[];
  files?: Record<string, unknown>[];
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
