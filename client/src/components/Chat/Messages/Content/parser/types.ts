import type {
  TMessageContentParts,
  TAttachment,
  TMessage,
  Agents,
} from 'librechat-data-provider';
import type { ToolArtifactType } from '~/utils/artifacts';

export type RenderableKind =
  | 'text'
  | 'think'
  | 'image'
  | 'error'
  | 'summary'
  | 'agent_update'
  | 'tool_call'
  | 'attachment'
  | 'artifact'
  | 'pending_skill'
  | 'empty_cursor';

export type RenderableSource =
  | 'content_part'
  | 'attachment'
  | 'artifact'
  | 'tool_output'
  | 'memory'
  | 'pending'
  | 'legacy_message';

export interface BaseRenderableItem {
  kind: RenderableKind;
  source: RenderableSource;
  renderKey: string;
  index: number;
  metadata: Record<string, unknown>;
}

export interface RenderableText extends BaseRenderableItem {
  kind: 'text';
  source: 'content_part' | 'legacy_message';
  text: string;
  showCursor?: boolean;
}

export interface RenderableThink extends BaseRenderableItem {
  kind: 'think';
  source: 'content_part';
  reasoning: string;
  isLast?: boolean;
}

export interface RenderableImage extends BaseRenderableItem {
  kind: 'image';
  source: 'content_part' | 'attachment';
  imagePath: string;
  altText: string;
  width?: number;
  height?: number;
}

export interface RenderableError extends BaseRenderableItem {
  kind: 'error';
  source: 'content_part' | 'legacy_message';
  text: string;
}

export interface RenderableSummary extends BaseRenderableItem {
  kind: 'summary';
  source: 'content_part';
  content: { type: string; text: string }[];
  model?: string;
  provider?: string;
  tokenCount?: number;
  summarizing?: boolean;
}

export interface RenderableAgentUpdate extends BaseRenderableItem {
  kind: 'agent_update';
  source: 'content_part';
  agentId: string;
}

export interface RenderableToolCall extends BaseRenderableItem {
  kind: 'tool_call';
  source: 'content_part';
  toolKind: string;
  toolName: string;
  toolCallId?: string;
  initialProgress?: number;
  args?: string | Record<string, unknown>;
  output?: string;
  auth?: string;
  attachments?: TAttachment[];
  hideAttachments?: boolean;
  onToolExpand?: () => void;
  isLast?: boolean;
  isSubmitting?: boolean;
  toolCall: Record<string, unknown>;
}

export interface RenderableAttachment extends BaseRenderableItem {
  kind: 'attachment';
  source: 'attachment';
  attachment: TAttachment;
  attachmentType?: 'image' | 'text' | 'file' | 'artifact' | 'mermaid';
}

export interface RenderableArtifact extends BaseRenderableItem {
  kind: 'artifact';
  source: 'artifact' | 'memory';
  attachment: TAttachment;
  artifactType: ToolArtifactType | 'mermaid';
}

export interface RenderablePendingSkill extends BaseRenderableItem {
  kind: 'pending_skill';
  source: 'pending';
  skillName: string;
  loaded: boolean;
}

export interface RenderableEmptyCursor extends BaseRenderableItem {
  kind: 'empty_cursor';
  source: 'content_part';
}

export type RenderableItem =
  | RenderableText
  | RenderableThink
  | RenderableImage
  | RenderableError
  | RenderableSummary
  | RenderableAgentUpdate
  | RenderableToolCall
  | RenderableAttachment
  | RenderableArtifact
  | RenderablePendingSkill
  | RenderableEmptyCursor;

export interface RenderableItemGroup {
  type: 'single' | 'tool_group' | 'parallel';
  items: RenderableItem[];
  groupId?: string;
  groupAttachments?: TAttachment[];
  groupMetadata?: Record<string, unknown>;
}

export interface ParseMessageContentOptions {
  messageId: string;
  message?: TMessage;
  content?: TMessageContentParts[];
  text?: string;
  attachments?: TAttachment[];
  manualSkills?: string[];
  isSubmitting?: boolean;
  isLast?: boolean;
  isCreatedByUser?: boolean;
  isLatestMessage?: boolean;
}

export type RenderableMatchInput = Pick<
  BaseRenderableItem,
  'kind' | 'source'
> & {
  metadata?: Record<string, unknown>;
  toolKind?: string;
  attachmentType?: string;
  artifactType?: string;
};
