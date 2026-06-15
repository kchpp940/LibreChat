import type { TAttachment, TMessage, TMessageContentParts } from 'librechat-data-provider';
import type { TMessageIcon, TMessageChatContext, TAskFunction } from './types';
import type { ToolArtifactType } from '~/utils/artifacts';

export enum MessageRenderStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  EMPTY = 'empty',
  ERROR = 'error',
  UNFINISHED = 'unfinished',
  EDITING = 'editing',
}

export enum BlockStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum AttachmentCategory {
  FILE = 'file',
  IMAGE = 'image',
  TEXT_PREVIEW = 'text_preview',
  ARTIFACT = 'artifact',
  MERMAID = 'mermaid',
  PENDING = 'pending',
}

export enum AttachmentStatus {
  READY = 'ready',
  LOADING = 'loading',
  FAILED = 'failed',
}

export enum ToolRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export enum ErrorType {
  CONNECTION = 'connection',
  MESSAGE = 'message',
  TOOL = 'tool',
  ATTACHMENT = 'attachment',
}

export type ContentBlockType =
  | 'text'
  | 'thinking'
  | 'tool_call'
  | 'image'
  | 'error'
  | 'agent_update'
  | 'summary';

export interface ContentBlockBase {
  id: string;
  type: ContentBlockType;
  status: BlockStatus;
  isLast: boolean;
  showCursor: boolean;
  nextType?: string;
  partIndex: number;
}

export interface TextBlock extends ContentBlockBase {
  type: 'text';
  text: string;
  toolCallIds?: string[];
}

export interface ThinkingBlock extends ContentBlockBase {
  type: 'thinking';
  reasoning: string;
}

export interface ToolCallBlock extends ContentBlockBase {
  type: 'tool_call';
  toolCallId: string;
  toolName: string;
  args: unknown;
  output?: string;
  progress: number;
  runStatus: ToolRunStatus;
  auth?: unknown;
  attachments?: TAttachment[];
  hideAttachments?: boolean;
  persistedContent?: TMessageContentParts[];
  isProgrammaticBash?: boolean;
  isBashTool?: boolean;
  isExecuteCode?: boolean;
  isImageGen?: boolean;
  isSkill?: boolean;
  isSubagent?: boolean;
  isReadFile?: boolean;
  isFileAuthoring?: boolean;
  isWebSearch?: boolean;
  isRetrieval?: boolean;
  isAgentHandoff?: boolean;
  isCodeInterpreter?: boolean;
  isGenericTool?: boolean;
}

export interface ImageBlock extends ContentBlockBase {
  type: 'image';
  filepath?: string;
  fileId?: string;
  filename?: string;
  width?: number;
  height?: number;
  cachedPreview?: string;
}

export interface ErrorBlock extends ContentBlockBase {
  type: 'error';
  message: string;
  errorType: ErrorType;
  retryable: boolean;
}

export interface AgentUpdateBlock extends ContentBlockBase {
  type: 'agent_update';
  agentId?: string;
}

export interface SummaryBlock extends ContentBlockBase {
  type: 'summary';
  content?: string;
  model?: string;
  provider?: string;
  tokenCount?: number;
  summarizing?: boolean;
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolCallBlock
  | ImageBlock
  | ErrorBlock
  | AgentUpdateBlock
  | SummaryBlock;

export interface AttachmentSummary {
  id: string;
  category: AttachmentCategory;
  status: AttachmentStatus;
  attachment: TAttachment;
  filename: string;
  displayName: string;
  filepath?: string;
  fileId?: string;
  previewError?: string;
  artifactType?: ToolArtifactType;
  isImage?: boolean;
  isText?: boolean;
  isDownloadable: boolean;
  isInternal: boolean;
  isWebSearch: boolean;
  sortKey: number;
}

export interface ErrorState {
  type: ErrorType;
  message: string;
  retryable: boolean;
  retryAction?: () => void;
}

export type CopyFn = (setIsCopied: React.Dispatch<React.SetStateAction<boolean>>) => void;

export interface MessageActions {
  ask: TAskFunction;
  index: number;
  edit: boolean;
  enterEdit: (cancel?: boolean) => void;
  regenerate: () => void;
  handleContinue: (e: React.MouseEvent<HTMLButtonElement>) => void;
  copyToClipboard: CopyFn;
  handleFeedback?: (params: { feedback: unknown }) => void;
}

export interface ToolCallGroupSummary {
  groupId: string;
  parts: Array<{ part: TMessageContentParts; idx: number }>;
  groupAttachments: TAttachment[];
  isSubmitting: boolean;
  isLast: boolean;
}

export interface MessageRenderState {
  readonly messageId: string;
  readonly isCreatedByUser: boolean;
  readonly isLatestMessage: boolean;
  readonly isLastInTree: boolean;
  readonly label: string;
  readonly iconData: TMessageIcon;
  readonly conversationId?: string | null;
  readonly endpoint?: string | null;
  readonly model?: string;

  readonly status: MessageRenderStatus;
  readonly error?: ErrorState;
  readonly isSubmitting: boolean;
  readonly edit: boolean;

  readonly blocks: ContentBlock[];
  readonly attachments: AttachmentSummary[];
  readonly searchResults?: Record<string, unknown>;

  readonly pendingSkills: string[];
  readonly hasRealContent: boolean;
  readonly hasPendingSkills: boolean;

  readonly hasParallelContent: boolean;
  readonly chatWidthClass: string;
  readonly parallelGroups?: string[];

  readonly toolCallGroups: ToolCallGroupSummary[];
  readonly showEmptyCursor: boolean;
  readonly showThinkingCursor: boolean;

  readonly actions: MessageActions;
  readonly siblingIdx?: number;
  readonly siblingCount?: number;
  readonly setSiblingIdx?: ((value: number) => void) | null;
  readonly currentEditId?: string | number | null;
  readonly setCurrentEditId?: React.Dispatch<
    React.SetStateAction<string | number | null>
  > | null;
  readonly agent?: unknown;
  readonly assistant?: unknown;
  readonly feedback?: unknown;
  readonly chatContext: TMessageChatContext;
}

export type AdaptMessageInput = {
  message: TMessage;
  edit: boolean;
  conversation?: unknown;
  currentEditId?: string | number | null;
  setCurrentEditId?: React.Dispatch<
    React.SetStateAction<string | number | null>
  > | null;
  siblingIdx?: number;
  siblingCount?: number;
  setSiblingIdx?: ((value: number) => void) | null;
  isSubmitting: boolean;
  isLatestMessage: boolean;
  latestMessageDepth?: number;
  attachments?: TAttachment[];
  searchResults?: Record<string, unknown>;
  maximizeChatSpace?: boolean;
  chatContext: TMessageChatContext;
  agent?: unknown;
  assistant?: unknown;
  feedback?: unknown;
  label: string;
  iconData: TMessageIcon;
  actions: MessageActions;
};
