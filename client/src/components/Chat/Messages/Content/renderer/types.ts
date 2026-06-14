import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import type { ComponentType, ReactNode } from 'react';

export interface RendererMatchResult {
  matched: boolean;
  priority?: number;
}

export interface ContentPartRendererProps {
  part: TMessageContentParts;
  isLast?: boolean;
  isSubmitting: boolean;
  showCursor: boolean;
  isCreatedByUser: boolean;
  attachments?: TAttachment[];
  hideAttachments?: boolean;
  onToolExpand?: () => void;
}

export interface ContentPartRenderer {
  id: string;
  name: string;
  type?: string;
  match: (part: TMessageContentParts) => RendererMatchResult;
  render: ComponentType<ContentPartRendererProps>;
  priority?: number;
}

export interface ToolCallRendererProps {
  toolCall: Record<string, unknown>;
  toolName: string;
  isSubmitting: boolean;
  attachments?: TAttachment[];
  hideAttachments?: boolean;
  onToolExpand?: () => void;
  isLast?: boolean;
  initialProgress?: number;
  output?: string;
  args?: string | Record<string, unknown>;
  auth?: boolean;
}

export interface ToolCallRenderer {
  id: string;
  name: string;
  match: (toolName: string, toolCall: Record<string, unknown>) => RendererMatchResult;
  render: ComponentType<ToolCallRendererProps>;
  priority?: number;
}

export interface AttachmentRendererProps {
  attachment: TAttachment;
}

export interface AttachmentRenderer {
  id: string;
  name: string;
  match: (attachment: TAttachment) => RendererMatchResult;
  render: ComponentType<AttachmentRendererProps>;
  priority?: number;
  skip?: (attachment: TAttachment) => boolean;
}

export type RendererCategory = 'contentPart' | 'toolCall' | 'attachment';

export interface RendererRegistryConfig {
  contentPartRenderers?: ContentPartRenderer[];
  toolCallRenderers?: ToolCallRenderer[];
  attachmentRenderers?: AttachmentRenderer[];
}
