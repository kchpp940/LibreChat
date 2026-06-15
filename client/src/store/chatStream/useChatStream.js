import { useCallback, useMemo } from 'react';
import { useChatStreamValue, useChatStreamDispatch, useChatStreamSelectors, useChatStreamIsRunning, useChatStreamShowStop, useChatStreamAbortScroll, useChatStreamSetAbortScroll, } from './atoms';
export function useChatStream(runIndex = 0) {
    const state = useChatStreamValue(runIndex);
    const dispatch = useChatStreamDispatch(runIndex);
    const selectors = useChatStreamSelectors(runIndex);
    const isRunning = useChatStreamIsRunning(runIndex);
    const showStopButton = useChatStreamShowStop(runIndex);
    const abortScroll = useChatStreamAbortScroll(runIndex);
    const setAbortScroll = useChatStreamSetAbortScroll(runIndex);
    const submitStart = useCallback((submission, conversation) => {
        dispatch({ type: 'SUBMIT_START', payload: { submission, conversation } });
    }, [dispatch]);
    const streamCreated = useCallback((runId, userMessage, responseMessage) => {
        dispatch({ type: 'STREAM_CREATED', payload: { runId, userMessage, responseMessage } });
    }, [dispatch]);
    const streamOpen = useCallback(() => {
        dispatch({ type: 'STREAM_OPEN' });
    }, [dispatch]);
    const streamReconnect = useCallback((attempt) => {
        dispatch({ type: 'STREAM_RECONNECT', payload: { attempt } });
    }, [dispatch]);
    const streamResumed = useCallback((streamId) => {
        dispatch({ type: 'STREAM_RESUMED', payload: { streamId } });
    }, [dispatch]);
    const setStreamId = useCallback((streamId) => {
        dispatch({ type: 'STREAM_ID_SET', payload: streamId });
    }, [dispatch]);
    const updateResponseMessage = useCallback((responseMessage) => {
        dispatch({ type: 'MESSAGE_UPDATE', payload: { responseMessage } });
    }, [dispatch]);
    const streamCompleted = useCallback((payload) => {
        dispatch({ type: 'STREAM_COMPLETED', payload });
    }, [dispatch]);
    const streamAborted = useCallback(() => {
        dispatch({ type: 'STREAM_ABORTED' });
    }, [dispatch]);
    const streamError = useCallback((error) => {
        dispatch({ type: 'STREAM_ERROR', payload: { error } });
    }, [dispatch]);
    const setStopButton = useCallback((value) => {
        dispatch({ type: 'SET_STOP_BUTTON', payload: value });
    }, [dispatch]);
    const addCompletedId = useCallback((messageId) => {
        dispatch({ type: 'ADD_COMPLETED_ID', payload: messageId });
    }, [dispatch]);
    const resetStream = useCallback(() => {
        dispatch({ type: 'RESET_STREAM' });
    }, [dispatch]);
    const isCompleted = useMemo(() => state.status === 'completed', [state.status]);
    const isFailed = useMemo(() => state.status === 'failed', [state.status]);
    const isAborted = useMemo(() => state.status === 'aborted', [state.status]);
    const isReconnecting = useMemo(() => state.status === 'reconnecting', [state.status]);
    const isResumed = useMemo(() => state.status === 'resumed', [state.status]);
    return {
        state,
        selectors,
        dispatch,
        status: state.status,
        submission: state.submission,
        conversation: state.conversation,
        activeRunId: state.activeRunId,
        streamId: state.streamId,
        userMessage: state.userMessage,
        responseMessage: state.responseMessage,
        error: state.error,
        abortScroll,
        showStopButton,
        isRunning,
        isCompleted,
        isFailed,
        isAborted,
        isReconnecting,
        isResumed,
        hasError: state.error != null,
        reconnectAttempts: state.reconnectAttempts,
        completedMessageIds: state.completedMessageIds,
        actions: {
            submitStart,
            streamCreated,
            streamOpen,
            streamReconnect,
            streamResumed,
            setStreamId,
            updateResponseMessage,
            streamCompleted,
            streamAborted,
            streamError,
            setAbortScroll,
            setStopButton,
            addCompletedId,
            resetStream,
        },
    };
}
