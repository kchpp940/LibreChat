import React, { useMemo, createContext, useContext } from 'react';
import type { TMessage, TTourData, TTourItem } from 'librechat-data-provider';
import type { MessagesViewContextValue } from '~/Providers/MessagesViewContext';
import { MessagesViewContext } from '~/Providers/MessagesViewContext';

interface ShareTourContextValue {
  tourItemByMessageId: Map<string, TTourItem>;
  tour: TTourData | undefined;
}

const ShareTourContext = createContext<ShareTourContextValue>({
  tourItemByMessageId: new Map(),
  tour: undefined,
});

export const useShareTour = (): ShareTourContextValue => useContext(ShareTourContext);

interface ShareMessagesProviderProps {
  messages: TMessage[];
  tour?: TTourData;
  children: React.ReactNode;
}

/**
 * Minimal MessagesViewContext provider for share view.
 * Provides conversation data needed by message components.
 * Uses the same MessagesViewContext as the main app for compatibility with existing hooks.
 *
 * Also provides ShareTourContext for tour data lookup by messageId.
 * All UI components (message tool fold, artifact/file summary) must use tour as single source of truth.
 *
 * Note: conversationId is set to undefined because share view is read-only and doesn't
 * need to check Recoil state for in-flight messages during streaming.
 */
export function ShareMessagesProvider({ messages, tour, children }: ShareMessagesProviderProps) {
  const contextValue = useMemo<MessagesViewContextValue>(
    () => ({
      conversation: null,
      conversationId: undefined,
      ask: () => {},
      regenerate: () => {},
      handleContinue: () => {},
      latestMessageId: messages[messages.length - 1]?.messageId,
      latestMessageDepth: messages[messages.length - 1]?.depth,
      isSubmitting: false,
      abortScroll: false,
      setAbortScroll: () => {},
      index: 0,
      getMessages: () => messages,
      setMessages: () => {},
    }),
    [messages],
  );

  const tourContextValue = useMemo<ShareTourContextValue>(() => {
    const map = new Map<string, TTourItem>();
    if (tour && tour.items) {
      for (const item of tour.items) {
        map.set(item.messageId, item);
      }
    }
    return { tourItemByMessageId: map, tour };
  }, [tour]);

  return (
    <ShareTourContext.Provider value={tourContextValue}>
      <MessagesViewContext.Provider value={contextValue}>{children}</MessagesViewContext.Provider>
    </ShareTourContext.Provider>
  );
}
