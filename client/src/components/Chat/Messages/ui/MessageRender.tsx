import React, { memo } from 'react';
import type { TMessage } from 'librechat-data-provider';
import type { TMessageProps, TMessageIcon, TMessageChatContext } from '~/common';
import { useAdaptedMessage } from '~/hooks';
import { RenderedMessage } from '~/components/Chat/Messages/ui/MessageRenderFromState';

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
  const { state, toolGroupExpansionRef, handleGroupExpansionChange, handleScroll } =
    useAdaptedMessage({
      message: msg,
      siblingIdx,
      siblingCount,
      setSiblingIdx,
      currentEditId,
      setCurrentEditId,
      chatContext,
      isSubmittingOverride: isSubmitting,
    });

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
        />
      </div>
    </div>
  );
}, areMessageRenderPropsEqual);

MessageRender.displayName = 'MessageRender';

export default MessageRender;
