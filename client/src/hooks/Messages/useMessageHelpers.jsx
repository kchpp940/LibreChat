import { useCallback, useMemo } from 'react';
import throttle from 'lodash/throttle';
import { isAssistantsEndpoint, isAgentsEndpoint } from 'librechat-data-provider';
import { useMessagesViewContext, useAssistantsMapContext, useAgentsMapContext } from '~/Providers';
import { useChatStream } from '~/store';
import useCopyToClipboard from './useCopyToClipboard';
import { useGetAddedConvo } from '~/hooks/Chat';
import { logger } from '~/utils';
export default function useMessageHelpers(props) {
    const { message, currentEditId, setCurrentEditId } = props;
    const { ask, index, regenerate, isSubmitting, conversation, handleContinue, latestMessageId, } = useMessagesViewContext();
    const setAbortScroll = useChatStream(index).actions.setAbortScroll;
    const agentsMap = useAgentsMapContext();
    const assistantMap = useAssistantsMapContext();
    const getAddedConvo = useGetAddedConvo();
    const { text, content, children, messageId = null, isCreatedByUser } = message ?? {};
    const edit = messageId === currentEditId;
    const isLast = children?.length === 0 || children?.length === undefined;
    const enterEdit = useCallback((cancel) => setCurrentEditId && setCurrentEditId(cancel === true ? -1 : messageId), [messageId, setCurrentEditId]);
    const handleScroll = useCallback((event) => {
        throttle(() => {
            logger.log('message_scrolling', `useMessageHelpers: setting abort scroll to ${isSubmitting}, handleScroll event`, event);
            if (isSubmitting) {
                setAbortScroll(true);
            }
            else {
                setAbortScroll(false);
            }
        }, 500)();
    }, [isSubmitting, setAbortScroll]);
    const assistant = useMemo(() => {
        if (!isAssistantsEndpoint(conversation?.endpoint)) {
            return undefined;
        }
        const endpointKey = conversation?.endpoint ?? '';
        const modelKey = message?.model ?? '';
        return assistantMap?.[endpointKey] ? assistantMap[endpointKey][modelKey] : undefined;
    }, [conversation?.endpoint, message?.model, assistantMap]);
    const agent = useMemo(() => {
        if (!isAgentsEndpoint(conversation?.endpoint)) {
            return undefined;
        }
        const modelKey = message?.model ?? '';
        return agentsMap ? agentsMap[modelKey] : undefined;
    }, [agentsMap, conversation?.endpoint, message?.model]);
    const regenerateMessage = () => {
        if ((isSubmitting && isCreatedByUser === true) || !message) {
            return;
        }
        regenerate(message, { addedConvo: getAddedConvo() });
    };
    const copyToClipboard = useCopyToClipboard({ text, content });
    return {
        ask,
        edit,
        agent,
        index,
        isLast,
        assistant,
        enterEdit,
        conversation,
        isSubmitting,
        handleScroll,
        handleContinue,
        latestMessageId,
        copyToClipboard,
        regenerateMessage,
    };
}
