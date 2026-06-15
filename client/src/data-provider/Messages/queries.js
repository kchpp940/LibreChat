import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Constants, QueryKeys, dataService } from 'librechat-data-provider';
import { isNotFoundError, logger } from '~/utils';
function isUnhydratedMessage(message) {
    const messageId = message.messageId ?? '';
    return message.createdAt == null || message.updatedAt == null || messageId.endsWith('_');
}
function hasPendingAssistantTail(messages) {
    const lastMessage = messages[messages.length - 1];
    const parentMessageId = lastMessage?.parentMessageId ?? '';
    return (lastMessage?.isCreatedByUser !== true &&
        parentMessageId !== '' &&
        parentMessageId !== Constants.NO_PARENT &&
        isUnhydratedMessage(lastMessage));
}
function isMessagePrefix(result, currentMessages) {
    return result.every((message, index) => message.messageId === currentMessages[index]?.messageId);
}
export function getStableMessages({ pathname, result, isStreaming = false, currentMessages, }) {
    if (pathname.includes('/c/new') || !currentMessages?.length) {
        return result;
    }
    if (result.length >= currentMessages.length) {
        return result;
    }
    if (isStreaming &&
        hasPendingAssistantTail(currentMessages) &&
        isMessagePrefix(result, currentMessages)) {
        return currentMessages;
    }
    return result;
}
export function shouldPreserveMessagesOnNotFound({ pathname, isStreaming = false, currentMessages, }) {
    if (!isStreaming || pathname.includes('/c/new') || !currentMessages?.length) {
        return false;
    }
    return hasPendingAssistantTail(currentMessages);
}
function hasActiveJob(queryClient, id) {
    if (!id) {
        return false;
    }
    const activeJobs = queryClient.getQueryData([QueryKeys.activeJobs]);
    return activeJobs?.activeJobIds?.includes(id) === true;
}
export const useGetMessagesByConvoId = (id, config, options) => {
    const location = useLocation();
    const queryClient = useQueryClient();
    const isStreaming = options?.isStreaming === true;
    const isStreamingRef = useRef(isStreaming);
    useLayoutEffect(() => {
        isStreamingRef.current = isStreaming;
    }, [isStreaming]);
    return useQuery([QueryKeys.messages, id], async () => {
        let result;
        try {
            result = await dataService.getMessagesByConvoId(id);
        }
        catch (error) {
            const currentMessages = queryClient.getQueryData([QueryKeys.messages, id]);
            const hasLiveStream = isStreamingRef.current || hasActiveJob(queryClient, id);
            if (currentMessages &&
                isNotFoundError(error) &&
                shouldPreserveMessagesOnNotFound({
                    pathname: location.pathname,
                    currentMessages,
                    isStreaming: hasLiveStream,
                })) {
                logger.warn('messages', `Messages query for convo ${id} returned 404 while cache has a pending assistant tail; path: "${location.pathname}"`, currentMessages);
                return currentMessages;
            }
            throw error;
        }
        const currentMessages = queryClient.getQueryData([QueryKeys.messages, id]);
        const stableMessages = getStableMessages({
            pathname: location.pathname,
            result,
            currentMessages,
            isStreaming: isStreamingRef.current || hasActiveJob(queryClient, id),
        });
        if (stableMessages === currentMessages) {
            logger.warn('messages', `Messages query for convo ${id} returned fewer than cache; path: "${location.pathname}"`, result, currentMessages);
        }
        return stableMessages;
    }, {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
