import React, { createContext, useContext, useMemo } from 'react';
import { useChatContext } from './ChatContext';
const MessagesViewContext = createContext(undefined);
// Export the context so it can be provided by other providers (e.g., ShareMessagesProvider)
export { MessagesViewContext };
export function MessagesViewProvider({ children }) {
    const chatContext = useChatContext();
    const { ask, index, regenerate, isSubmitting, conversation, latestMessageId, latestMessageDepth, handleContinue, abortScroll, getMessages, setMessages, } = chatContext;
    /** Memoize conversation-related values */
    const conversationValues = useMemo(() => ({
        conversation,
        conversationId: conversation?.conversationId,
    }), [conversation]);
    /** Memoize submission states */
    const submissionStates = useMemo(() => ({
        abortScroll,
        isSubmitting,
    }), [isSubmitting, abortScroll]);
    /** Memoize message operations (these are typically stable references) */
    const messageOperations = useMemo(() => ({
        ask,
        regenerate,
        getMessages,
        setMessages,
        handleContinue,
    }), [ask, regenerate, handleContinue, getMessages, setMessages]);
    /** Memoize message state values */
    const messageState = useMemo(() => ({
        index,
        latestMessageId,
        latestMessageDepth,
    }), [index, latestMessageId, latestMessageDepth]);
    /** Combine all values into final context value */
    const contextValue = useMemo(() => ({
        ...conversationValues,
        ...submissionStates,
        ...messageOperations,
        ...messageState,
    }), [conversationValues, submissionStates, messageOperations, messageState]);
    return (<MessagesViewContext.Provider value={contextValue}>{children}</MessagesViewContext.Provider>);
}
export function useMessagesViewContext() {
    const context = useContext(MessagesViewContext);
    if (!context) {
        throw new Error('useMessagesViewContext must be used within MessagesViewProvider');
    }
    return context;
}
/** Hook for components that only need conversation data */
export function useMessagesConversation() {
    const { conversation, conversationId } = useMessagesViewContext();
    return useMemo(() => ({ conversation, conversationId }), [conversation, conversationId]);
}
/** Hook for components that only need submission states */
export function useMessagesSubmission() {
    const { isSubmitting, abortScroll } = useMessagesViewContext();
    return useMemo(() => ({ isSubmitting, abortScroll }), [isSubmitting, abortScroll]);
}
/** Hook for components that only need message operations */
export function useMessagesOperations() {
    const { ask, regenerate, handleContinue, getMessages, setMessages } = useMessagesViewContext();
    return useMemo(() => ({ ask, regenerate, handleContinue, getMessages, setMessages }), [ask, regenerate, handleContinue, getMessages, setMessages]);
}
const NOOP_OPS = {
    ask: () => { },
    regenerate: () => { },
    handleContinue: () => { },
    getMessages: () => undefined,
    setMessages: () => { },
};
/**
 * Hook for components that need message operations but may render outside MessagesViewProvider
 * (e.g. the /search route). Returns no-op stubs when the provider is absent — UI actions will
 * be silently discarded rather than crashing. Callers must use optional chaining on
 * `getMessages()` results, as it returns `undefined` outside the provider.
 */
export function useOptionalMessagesOperations() {
    const context = useContext(MessagesViewContext);
    const ask = context?.ask;
    const regenerate = context?.regenerate;
    const handleContinue = context?.handleContinue;
    const getMessages = context?.getMessages;
    const setMessages = context?.setMessages;
    return useMemo(() => ({
        ask: ask ?? NOOP_OPS.ask,
        regenerate: regenerate ?? NOOP_OPS.regenerate,
        handleContinue: handleContinue ?? NOOP_OPS.handleContinue,
        getMessages: getMessages ?? NOOP_OPS.getMessages,
        setMessages: setMessages ?? NOOP_OPS.setMessages,
    }), [ask, regenerate, handleContinue, getMessages, setMessages]);
}
/**
 * Hook for components that need conversation data but may render outside MessagesViewProvider
 * (e.g. the /search route). Returns `undefined` for both fields when the provider is absent.
 */
export function useOptionalMessagesConversation() {
    const context = useContext(MessagesViewContext);
    const conversation = context?.conversation;
    const conversationId = context?.conversationId;
    return useMemo(() => ({ conversation, conversationId }), [conversation, conversationId]);
}
/** Hook for components that only need message state */
export function useMessagesState() {
    const { index, latestMessageId, latestMessageDepth } = useMessagesViewContext();
    return useMemo(() => ({ index, latestMessageId, latestMessageDepth }), [index, latestMessageId, latestMessageDepth]);
}
