import type { TConversation } from 'librechat-data-provider';
import type { ChatStreamState, ChatStreamAction, StreamStatus } from './types';

export function createInitialState(
  runIndex: string | number,
): ChatStreamState {
  const now = Date.now();
  return {
    status: 'idle',
    runIndex,
    submission: null,
    conversation: null,
    activeRunId: null,
    streamId: null,
    userMessage: null,
    responseMessage: null,
    error: null,
    abortScroll: false,
    showStopButton: false,
    reconnectAttempts: 0,
    completedMessageIds: new Set(),
    createdAt: now,
    updatedAt: now,
  };
}

const isTerminalStatus = (status: StreamStatus): boolean =>
  status === 'completed' || status === 'failed' || status === 'aborted';

const isRunningStatus = (status: StreamStatus): boolean =>
  status === 'submitting' || status === 'streaming' || status === 'reconnecting' || status === 'resumed';

function markUpdated(state: ChatStreamState): ChatStreamState {
  return { ...state, updatedAt: Date.now() };
}

export function chatStreamReducer(
  state: ChatStreamState,
  action: ChatStreamAction,
): ChatStreamState {
  switch (action.type) {
    case 'SUBMIT_START': {
      const { submission, conversation, userMessage, responseMessage } = action.payload;
      return markUpdated({
        ...state,
        status: 'submitting',
        submission,
        conversation: (conversation as TConversation) ?? state.conversation,
        userMessage: userMessage ?? submission.userMessage ?? state.userMessage,
        responseMessage: responseMessage ?? submission.initialResponse ?? state.responseMessage,
        error: null,
        showStopButton: true,
        abortScroll: false,
        reconnectAttempts: 0,
        activeRunId: null,
        streamId: null,
      });
    }

    case 'STREAM_CREATED': {
      const { runId, userMessage, responseMessage } = action.payload;
      return markUpdated({
        ...state,
        status: 'streaming',
        activeRunId: runId,
        userMessage,
        responseMessage,
        showStopButton: true,
      });
    }

    case 'STREAM_OPEN': {
      return markUpdated({
        ...state,
        status: isRunningStatus(state.status) ? state.status : 'streaming',
        abortScroll: false,
        showStopButton: true,
        reconnectAttempts: 0,
      });
    }

    case 'STREAM_RECONNECT': {
      const { attempt } = action.payload;
      return markUpdated({
        ...state,
        status: 'reconnecting',
        reconnectAttempts: attempt,
        showStopButton: true,
      });
    }

    case 'STREAM_RESUMED': {
      const { streamId } = action.payload;
      return markUpdated({
        ...state,
        status: 'resumed',
        streamId,
        showStopButton: true,
        abortScroll: false,
      });
    }

    case 'STREAM_ID_SET': {
      return markUpdated({
        ...state,
        streamId: action.payload,
      });
    }

    case 'MESSAGE_UPDATE': {
      return markUpdated({
        ...state,
        responseMessage: action.payload.responseMessage,
      });
    }

    case 'STREAM_COMPLETED': {
      return markUpdated({
        ...state,
        status: 'completed',
        showStopButton: false,
        error: null,
      });
    }

    case 'STREAM_ABORTED': {
      return markUpdated({
        ...state,
        status: 'aborted',
        showStopButton: false,
      });
    }

    case 'STREAM_ERROR': {
      return markUpdated({
        ...state,
        status: 'failed',
        error: action.payload.error,
        showStopButton: false,
      });
    }

    case 'SET_ABORT_SCROLL': {
      if (state.abortScroll === action.payload) {
        return state;
      }
      return markUpdated({
        ...state,
        abortScroll: action.payload,
      });
    }

    case 'SET_STOP_BUTTON': {
      if (state.showStopButton === action.payload) {
        return state;
      }
      return markUpdated({
        ...state,
        showStopButton: action.payload,
      });
    }

    case 'ADD_COMPLETED_ID': {
      if (!action.payload || state.completedMessageIds.has(action.payload)) {
        return state;
      }
      const next = new Set(state.completedMessageIds);
      next.add(action.payload);
      return markUpdated({
        ...state,
        completedMessageIds: next,
      });
    }

    case 'RESET_STREAM': {
      return createInitialState(state.runIndex);
    }

    default: {
      return state;
    }
  }
}

export function deriveSelectors(state: ChatStreamState) {
  const { status, error, showStopButton } = state;
  return {
    isRunning: isRunningStatus(status),
    isStreaming: status === 'streaming' || status === 'resumed',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    isAborted: status === 'aborted',
    isResumed: status === 'resumed',
    isReconnecting: status === 'reconnecting',
    hasError: error != null,
    shouldShowStop: showStopButton && isRunningStatus(status),
    showStopButton,
    displayStatus: status,
  };
}

export { isTerminalStatus, isRunningStatus };
