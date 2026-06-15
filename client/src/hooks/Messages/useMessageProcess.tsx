import throttle from 'lodash/throttle';
import { useEffect, useRef, useMemo } from 'react';
import type { TMessage } from 'librechat-data-provider';
import { useMessagesViewContext } from '~/Providers';
import { useChatStream } from '~/store';
import { logger } from '~/utils';

export default function useMessageProcess({ message: _message }: { message?: TMessage | null }) {
  const { conversation, isSubmitting, index } = useMessagesViewContext();
  const setAbortScroll = useChatStream(index).actions.setAbortScroll;

  /** Use ref for isSubmitting to stabilize handleScroll across isSubmitting changes */
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  const handleScroll = useMemo(
    () =>
      throttle((event: unknown) => {
        logger.log(
          'message_scrolling',
          `useMessageProcess: setting abort scroll to ${isSubmittingRef.current}, handleScroll event`,
          event,
        );
        setAbortScroll(isSubmittingRef.current);
      }, 500),
    [setAbortScroll],
  );

  useEffect(() => () => handleScroll.cancel(), [handleScroll]);

  return {
    handleScroll,
    isSubmitting,
    conversation,
  };
}
