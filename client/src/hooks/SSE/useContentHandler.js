import { useCallback, useMemo } from 'react';
import { ContentTypes } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { addFileToCache } from '~/utils';
export default function useContentHandler({ setMessages, getMessages }) {
    const queryClient = useQueryClient();
    const messageMap = useMemo(() => new Map(), []);
    /** Reset the message map - call this after sync to prevent stale state from overwriting synced content */
    const resetMessageMap = useCallback(() => {
        messageMap.clear();
    }, [messageMap]);
    const handler = useCallback(({ data, submission }) => {
        const { type, messageId, thread_id, conversationId, index } = data;
        const _messages = getMessages();
        const messages = _messages?.filter((m) => m.messageId !== messageId).map((msg) => ({ ...msg, thread_id })) ??
            [];
        const userMessage = messages[messages.length - 1];
        const { initialResponse } = submission;
        let response = messageMap.get(messageId);
        if (!response) {
            // Check if message already exists in current messages (e.g., after sync)
            // Use that as base instead of stale initialResponse
            const existingMessage = _messages?.find((m) => m.messageId === messageId);
            response = {
                ...(existingMessage ?? initialResponse),
                parentMessageId: userMessage?.messageId ?? '',
                conversationId,
                messageId,
                thread_id,
            };
            messageMap.set(messageId, response);
        }
        // TODO: handle streaming for non-text
        const textPart = data[ContentTypes.TEXT];
        const part = textPart != null && typeof textPart === 'string' ? { value: textPart } : data[type];
        if (type === ContentTypes.IMAGE_FILE) {
            addFileToCache(queryClient, part);
        }
        /* spreading the content array to avoid mutation */
        response.content = [...(response.content ?? [])];
        response.content[index] = { type, [type]: part };
        const lastContentPart = response.content[response.content.length - 1];
        const initialContentPart = initialResponse.content?.[0];
        if (type !== ContentTypes.TEXT &&
            initialContentPart != null &&
            lastContentPart != null &&
            ((lastContentPart.type === ContentTypes.TOOL_CALL &&
                lastContentPart[ContentTypes.TOOL_CALL]?.progress === 1) ||
                lastContentPart.type === ContentTypes.IMAGE_FILE)) {
            response.content.push(initialContentPart);
        }
        setMessages([...messages, response]);
    }, [queryClient, getMessages, messageMap, setMessages]);
    return { contentHandler: handler, resetContentHandler: resetMessageMap };
}
