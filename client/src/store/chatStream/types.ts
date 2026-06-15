import type { TMessage, TSubmission, TConversation } from 'librechat-data-provider';
import type { TResData, TFinalResData } from '~/common';
import type { EventSubmission } from 'librechat-data-provider';

export type StreamStatus =
  | 'idle'
  | 'submitting'
  | 'streaming'
  | 'reconnecting'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'resumed';

export interface StreamError {
  message: string;
  code?: string;
  data?: unknown;
}

export interface ChatStreamState {
  status: StreamStatus;
  runIndex: string | number;
  submission: TSubmission | null;
  conversation: TConversation | null;
  activeRunId: string | null;
  streamId: string | null;
  userMessage: TMessage | null;
  responseMessage: TMessage | null;
  error: StreamError | null;
  abortScroll: boolean;
  showStopButton: boolean;
  reconnectAttempts: number;
  completedMessageIds: Set<string>;
  createdAt: number;
  updatedAt: number;
}

export type ChatStreamAction =
  | { type: 'SUBMIT_START'; payload: { submission: TSubmission | null; conversation: Partial<TConversation> | null; userMessage?: TMessage | null; responseMessage?: TMessage | null } }
  | { type: 'STREAM_CREATED'; payload: { runId: string; userMessage: TMessage; responseMessage: TMessage } }
  | { type: 'STREAM_OPEN' }
  | { type: 'STREAM_RECONNECT'; payload: { attempt: number } }
  | { type: 'STREAM_RESUMED'; payload: { streamId: string } }
  | { type: 'STREAM_ID_SET'; payload: string }
  | { type: 'MESSAGE_UPDATE'; payload: { responseMessage: TMessage } }
  | { type: 'STREAM_COMPLETED'; payload?: TFinalResData }
  | { type: 'STREAM_ABORTED' }
  | { type: 'STREAM_ERROR'; payload: { error: StreamError } }
  | { type: 'SET_ABORT_SCROLL'; payload: boolean }
  | { type: 'SET_STOP_BUTTON'; payload: boolean }
  | { type: 'ADD_COMPLETED_ID'; payload: string | undefined }
  | { type: 'RESET_STREAM' };

export interface ChatStreamSelectors {
  isRunning: boolean;
  isStreaming: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isAborted: boolean;
  isResumed: boolean;
  isReconnecting: boolean;
  hasError: boolean;
  shouldShowStop: boolean;
  showStopButton: boolean;
  displayStatus: StreamStatus;
}

export type SSEEventData =
  | { final?: boolean; aborted?: boolean } & Partial<TResData>
  | { created?: boolean; message?: TMessage }
  | { event: string; data?: unknown }
  | { sync?: boolean; resumeState?: unknown; pendingEvents?: unknown[] }
  | { type?: string; text?: string; index?: number }
  | { message?: TMessage; text?: string; response?: string }
  | Record<string, unknown>;
