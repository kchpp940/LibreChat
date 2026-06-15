import React, { memo, useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import type { TMessage, TMessageContentParts } from 'librechat-data-provider';
import type { TMessageProps, TMessageIcon, TMessageChatContext } from '~/common';
import { cn, getHeaderPrefixForScreenReader, getMessageAriaLabel } from '~/utils';
import MessageContent from '~/components/Chat/Messages/Content/MessageContent';
import { useLocalize, useMessageActions, useContentMetadata, useAdaptedMessage } from '~/hooks';
import PlaceholderRow from '~/components/Chat/Messages/ui/PlaceholderRow';
import SiblingSwitch from '~/components/Chat/Messages/SiblingSwitch';
import HoverButtons from '~/components/Chat/Messages/HoverButtons';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import SubRow from '~/components/Chat/Messages/SubRow';
import { fontSizeAtom } from '~/store/fontSize';
import { MessageContext } from '~/Providers';
import { RenderedMessage } from '~/components/Chat/Messages/ui/MessageRenderFromState';
import store from '~/store';
import { ContentTypes } from 'librechat-data-provider';

type MessageRenderProps = {
  message?: TMessage;
  isSubmitting?: boolean;
  chatContext: TMessageChatContext;
} & Pick<
  TMessageProps,
  'currentEditId' | 'setCurrentEditId' | 'siblingIdx' | 'setSiblingIdx' | 'siblingCount'
>;

function areMessageRenderPropsEqual(prev: MessageRenderProps, next: MessageRenderProps): boolean {
  if (prev.isSubmitting !== next.isSubmitting) return false;
  if (prev.chatContext !== next.chatContext) return false;
  if (prev.siblingIdx !== next.siblingIdx) return false;
  if (prev.siblingCount !== next.siblingCount) return false;
  if (prev.currentEditId !== next.currentEditId) return false;
  if (prev.setSiblingIdx !== next.setSiblingIdx) return false;
  if (prev.setCurrentEditId !== next.setCurrentEditId) return false;

  const prevMsg = prev.message;
  const nextMsg = next.message;
  if (prevMsg === nextMsg) return true;
  if (!prevMsg || !nextMsg) return prevMsg === nextMsg;

  return (
    prevMsg.messageId === nextMsg.messageId &&
    prevMsg.text === nextMsg.text &&
    prevMsg.error === nextMsg.error &&
    prevMsg.unfinished === nextMsg.unfinished &&
    prevMsg.depth === nextMsg.depth &&
    prevMsg.isCreatedByUser === nextMsg.isCreatedByUser &&
    (prevMsg.children?.length ?? 0) === (nextMsg.children?.length ?? 0) &&
    prevMsg.content === nextMsg.content &&
    prevMsg.model === nextMsg.model &&
    prevMsg.endpoint === nextMsg.endpoint &&
    prevMsg.iconURL === nextMsg.iconURL &&
    prevMsg.feedback?.rating === nextMsg.feedback?.rating &&
    (prevMsg.files?.length ?? 0) === (nextMsg.files?.length ?? 0)
  );
}

const MessageRender = memo(function MessageRender({
  message: msg,
  siblingIdx,
  siblingCount,
  setSiblingIdx,
  currentEditId,
  setCurrentEditId,
  isSubmitting = false,
  chatContext,
}: MessageRenderProps) {
  const adapted = useAdaptedMessage({
    message: msg,
    siblingIdx,
    siblingCount,
    setSiblingIdx,
    currentEditId,
    setCurrentEditId,
    chatContext,
    isSubmittingOverride: isSubmitting,
  });

  const { state, toolGroupExpansionRef, handleGroupExpansionChange, handleScroll } = adapted;
  const localize = useLocalize();
  const fontSize = useAtomValue(fontSizeAtom);
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);

  const allContentParts = useMemo<TMessageContentParts[]>(() => {
    if (!msg || !Array.isArray(msg.content)) return [];
    return (msg.content.filter(Boolean) as TMessageContentParts[]) ?? [];
  }, [msg]);

  const renderPartFn = useCallback(
    (
      part: TMessageContentParts,
      idx: number,
      isLastPart: boolean,
      onToolExpand?: () => void,
    ) => {
      if (!state.blocks[idx]) return null;
      const block = state.blocks[idx];
      if (!block) return null;
      return (
        <MessageContext.Provider
          key={`provider-${state.messageId}-${idx}`}
          value={{
            messageId: state.messageId,
            isExpanded: true as const,
            conversationId: state.conversationId,
            partIndex: idx,
            nextType: allContentParts[idx + 1]?.type,
            isSubmitting: state.isSubmitting,
            isLatestMessage: state.isLatestMessage,
          }}
        >
          {(() => {
            switch (block.type) {
              case 'text': {
                const b = block as any;
                if (b.status === 'loading' && !b.text) {
                  return (
                    <div key={`fallback-container-${idx}`}>
                      <PlaceholderRow />
                    </div>
                  );
                }
                return null;
              }
              default:
                return null;
            }
          })()}
        </MessageContext.Provider>
      );
    },
    [state, allContentParts],
  );

  if (!msg) {
    return null;
  }

  return (
    <div
      onWheel={handleScroll}
      onTouchMove={handleScroll}
      className="text-token-text-primary w-full border-0 bg-transparent dark:border-0 dark:bg-transparent"
    >
      <div className="m-auto justify-center p-4 py-2 md:gap-6">
        <RenderedMessage
          state={state}
          conversation={chatContext.conversation}
          messageChildren={msg.children ?? []}
          toolGroupExpansionRef={toolGroupExpansionRef}
          handleGroupExpansionChange={handleGroupExpansionChange}
          allContentParts={allContentParts}
          renderPartFn={renderPartFn}
        />
      </div>
    </div>
  );
}, areMessageRenderPropsEqual);

MessageRender.displayName = 'MessageRender';

export default MessageRender;
