import React, { createContext, useContext, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { useLatestMessage } from '~/hooks/Messages/useLatestMessage';
import { getLatestText } from '~/utils';
import store from '~/store';
const ArtifactsContext = createContext(undefined);
export function ArtifactsProvider({ children, value }) {
    const isSubmitting = useRecoilValue(store.isSubmittingFamily(0));
    const latestMessage = useLatestMessage(0);
    const conversationId = useRecoilValue(store.conversationIdByIndex(0));
    const chatLatestMessageText = useMemo(() => {
        return getLatestText(latestMessage);
    }, [latestMessage]);
    const defaultContextValue = useMemo(() => ({
        isSubmitting,
        conversationId: conversationId ?? null,
        latestMessageText: chatLatestMessageText,
        latestMessageId: latestMessage?.messageId ?? null,
    }), [isSubmitting, chatLatestMessageText, latestMessage?.messageId, conversationId]);
    const contextValue = useMemo(() => (value ? { ...defaultContextValue, ...value } : defaultContextValue), [defaultContextValue, value]);
    return <ArtifactsContext.Provider value={contextValue}>{children}</ArtifactsContext.Provider>;
}
export function useArtifactsContext() {
    const context = useContext(ArtifactsContext);
    if (!context) {
        throw new Error('useArtifactsContext must be used within ArtifactsProvider');
    }
    return context;
}
