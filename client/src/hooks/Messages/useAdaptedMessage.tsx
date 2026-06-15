import { useCallback, useMemo, useRef } from 'react';
import type { TMessage } from 'librechat-data-provider';
import { useRecoilValue } from 'recoil';
import {
  useMessageActions,
  useMessageRenderState,
  useAttachments,
  useContentMetadata,
  useMemoizedChatContext,
  useMessageProcess,
} from '~/hooks/Messages';
import type { TMessageProps } from '~/common';
import type { ToolCallGroupExpansionState } from '~/components/Chat/Messages/Content/ToolCallGroup';
import type { TMessageIcon, TMessageChatContext } from '~/common';
import { useAssistantsMapContext, useAgentsMapContext } from '~/Providers';
import store from '~/store';
import { useLocalize } from '~/hooks';
import type { MessageRenderState } from '~/common/messageRenderTypes';
import { useAuthContext } from '~/hooks/AuthContext';

export type UseAdaptedMessageResult = {
  state: MessageRenderState;
  toolGroupExpansionRef: React.MutableRefObject<
    Map<string, ToolCallGroupExpansionState>
  >;
  handleGroupExpansionChange: (
    groupId: string,
    s: ToolCallGroupExpansionState,
  ) => void;
  handleScroll: (event?: unknown) => void;
};

export default function useAdaptedMessage(
  props: TMessageProps & {
    chatContext?: TMessageChatContext;
    isSubmittingOverride?: boolean;
  },
): UseAdaptedMessageResult {
  const { message, currentEditId, setCurrentEditId, siblingIdx, siblingCount, setSiblingIdx } =
    props;
  const localize = useLocalize();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
  const UsernameDisplay = useRecoilValue<boolean>(store.UsernameDisplay);
  const { user } = useAuthContext();

  const { attachments, searchResults } = useAttachments({
    messageId: message?.messageId,
    attachments: message?.attachments,
  });

  const effectiveIsSubmittingVal = props.isSubmittingOverride;

  const { handleScroll: processScroll } = useMessageProcess({ message });

  const {
    chatContext: memoChatContext,
    effectiveIsSubmitting: memoEffectiveIsSubmitting,
  } = useMemoizedChatContext(message ?? ({} as TMessage), props.isSubmittingOverride ?? false);

  const chatContext: TMessageChatContext = props.chatContext ?? memoChatContext;
  const computedIsSubmitting =
    effectiveIsSubmittingVal !== undefined
      ? effectiveIsSubmittingVal
      : memoEffectiveIsSubmitting;

  const isLatestMessage = message?.messageId === chatContext.latestMessageId;

  const actions = useMessageActions({
    message,
    currentEditId,
    setCurrentEditId,
    chatContext,
  });

  const { hasParallelContent } = useContentMetadata(message);

  const label = useMemo(() => {
    if (message?.isCreatedByUser === true) {
      return UsernameDisplay
        ? (user?.name ?? '') || user?.username
        : localize('com_user_message');
    } else if (actions.agent) {
      return (actions.agent as { name?: string }).name ?? 'Assistant';
    } else if (actions.assistant) {
      return (actions.assistant as { name?: string }).name ?? 'Assistant';
    } else {
      return message?.sender;
    }
  }, [message, actions.agent, actions.assistant, UsernameDisplay, user, localize]);

  const iconData: TMessageIcon = useMemo(
    () => ({
      endpoint: message?.endpoint ?? chatContext.conversation?.endpoint,
      model: message?.model ?? chatContext.conversation?.model,
      iconURL: message?.iconURL,
      modelLabel: label,
      isCreatedByUser: message?.isCreatedByUser,
    }),
    [
      label,
      chatContext.conversation?.endpoint,
      chatContext.conversation?.model,
      message?.model,
      message?.iconURL,
      message?.endpoint,
      message?.isCreatedByUser,
    ],
  );

  const toolGroupExpansionRef = useRef(new Map<string, ToolCallGroupExpansionState>());
  const fallbackScopeRef = useRef({ messageId: message?.messageId ?? '', scope: 0 });
  if (fallbackScopeRef.current.messageId !== (message?.messageId ?? '')) {
    if (!computedIsSubmitting) {
      fallbackScopeRef.current.scope += 1;
      toolGroupExpansionRef.current.clear();
    }
    fallbackScopeRef.current.messageId = message?.messageId ?? '';
  }

  const handleGroupExpansionChange = useCallback(
    (groupId: string, s: ToolCallGroupExpansionState) => {
      if (!s.userOverride) {
        toolGroupExpansionRef.current.delete(groupId);
        return;
      }
      toolGroupExpansionRef.current.set(groupId, s);
    },
    [],
  );

  const input = useMemo(
    () => ({
      message: message ?? ({} as TMessage),
      edit: actions.edit,
      conversation: chatContext.conversation,
      currentEditId,
      setCurrentEditId,
      siblingIdx,
      siblingCount,
      setSiblingIdx,
      isSubmitting: computedIsSubmitting,
      isLatestMessage,
      latestMessageDepth: chatContext.latestMessageDepth,
      attachments,
      searchResults,
      maximizeChatSpace,
      chatContext,
      agent: actions.agent,
      assistant: actions.assistant,
      feedback: actions.feedback,
      label: label ?? '',
      iconData,
      actions: {
        ask: actions.ask,
        index: actions.index,
        edit: actions.edit,
        enterEdit: actions.enterEdit,
        regenerate: actions.regenerateMessage,
        handleContinue: actions.handleContinue,
        copyToClipboard: actions.copyToClipboard,
        handleFeedback: actions.handleFeedback,
      },
    }),
    [
      message,
      chatContext,
      currentEditId,
      setCurrentEditId,
      siblingIdx,
      siblingCount,
      setSiblingIdx,
      computedIsSubmitting,
      isLatestMessage,
      attachments,
      searchResults,
      maximizeChatSpace,
      actions,
      label,
      iconData,
    ],
  );

  const state = useMessageRenderState(input as any);

  return {
    state,
    toolGroupExpansionRef,
    handleGroupExpansionChange,
    handleScroll: processScroll,
  };
}
