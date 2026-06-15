import { useEffect, useState } from 'react';
import { SSE } from 'sse.js';
import { request, createPayload, removeNullishValues } from 'librechat-data-provider';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import useEventHandlers from './useEventHandlers';
import { clearAllDrafts } from '~/utils';
import { useChatStreamDispatch } from '~/store';
export default function useSSE(submission, chatHelpers, isAddedRequest = false, runIndex = 0) {
    const chatStreamDispatch = useChatStreamDispatch(runIndex);
    const { token, isAuthenticated } = useAuthContext();
    const [completed, setCompleted] = useState(new Set());
    const { setMessages, getMessages, setConversation, newConversation } = chatHelpers;
    const { clearStepMaps, stepHandler, syncHandler, finalHandler, errorHandler, messageHandler, contentHandler, createdHandler, titleHandler, attachmentHandler, abortConversation, } = useEventHandlers({
        setMessages,
        getMessages,
        setCompleted,
        isAddedRequest,
        setConversation,
        newConversation,
        runIndex,
    });
    const { data: startupConfig } = useGetStartupConfig();
    const balanceQuery = useGetUserBalance({
        enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
    });
    useEffect(() => {
        if (submission == null || Object.keys(submission).length === 0) {
            return;
        }
        chatStreamDispatch({
            type: 'SUBMIT_START',
            payload: {
                submission,
                conversation: submission.conversation,
                userMessage: submission.userMessage,
                responseMessage: submission.initialResponse,
            },
        });
        let { userMessage } = submission;
        const payloadData = createPayload(submission);
        let { payload } = payloadData;
        payload = removeNullishValues(payload);
        let textIndex = null;
        clearStepMaps();
        const sse = new SSE(payloadData.server, {
            payload: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        sse.addEventListener('attachment', (e) => {
            try {
                const data = JSON.parse(e.data);
                attachmentHandler({ data, submission: submission });
            }
            catch (error) {
                console.error(error);
            }
        });
        sse.addEventListener('message', (e) => {
            const data = JSON.parse(e.data);
            if (data.final != null) {
                clearAllDrafts(submission.conversation?.conversationId);
                try {
                    finalHandler(data, submission);
                }
                catch (error) {
                    console.error('Error in finalHandler:', error);
                }
                (startupConfig?.balance?.enabled ?? false) && balanceQuery.refetch();
                console.log('final', data);
                return;
            }
            else if (data.created != null) {
                userMessage = {
                    ...userMessage,
                    ...data.message,
                    overrideParentMessageId: userMessage.overrideParentMessageId,
                };
                createdHandler(data, { ...submission, userMessage });
            }
            else if (data.event === 'title') {
                titleHandler(data);
            }
            else if (data.event != null) {
                stepHandler(data, { ...submission, userMessage });
            }
            else if (data.sync != null) {
                /* synchronize messages to Assistants API as well as with real DB ID's */
                syncHandler(data, { ...submission, userMessage });
            }
            else if (data.type != null) {
                const { text, index } = data;
                if (text != null && index !== textIndex) {
                    textIndex = index;
                }
                contentHandler({ data, submission: submission });
            }
            else {
                const text = data.text ?? data.response;
                const initialResponse = {
                    ...submission.initialResponse,
                    parentMessageId: data.parentMessageId,
                    messageId: data.messageId,
                };
                if (data.message != null) {
                    messageHandler(text, { ...submission, userMessage, initialResponse });
                }
            }
        });
        sse.addEventListener('open', () => {
            chatStreamDispatch({ type: 'STREAM_OPEN' });
            console.log('connection is opened');
        });
        sse.addEventListener('cancel', async () => {
            const streamKey = submission?.['initialResponse']?.messageId;
            if (completed.has(streamKey)) {
                setCompleted((prev) => {
                    prev.delete(streamKey);
                    return new Set(prev);
                });
                return;
            }
            setCompleted((prev) => new Set(prev.add(streamKey)));
            chatStreamDispatch({ type: 'ADD_COMPLETED_ID', payload: streamKey });
            chatStreamDispatch({ type: 'STREAM_ABORTED' });
            const latestMessages = getMessages();
            const conversationId = latestMessages?.[latestMessages.length - 1]?.conversationId;
            try {
                await abortConversation(conversationId ??
                    userMessage.conversationId ??
                    submission.conversation?.conversationId ??
                    '', submission, latestMessages);
            }
            catch (error) {
                console.error('Error during abort:', error);
            }
        });
        sse.addEventListener('error', async (e) => {
            /* @ts-ignore */
            if (e.responseCode === 401) {
                /* token expired, refresh and retry */
                try {
                    const refreshResponse = await request.refreshToken();
                    const token = refreshResponse?.token ?? '';
                    if (!token) {
                        throw new Error('Token refresh failed.');
                    }
                    sse.headers = {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    };
                    request.dispatchTokenUpdatedEvent(token);
                    sse.stream();
                    return;
                }
                catch (error) {
                    /* token refresh failed, continue handling the original 401 */
                    console.log(error);
                }
            }
            console.log('error in server stream.');
            (startupConfig?.balance?.enabled ?? false) && balanceQuery.refetch();
            let data = undefined;
            try {
                data = JSON.parse(e.data);
            }
            catch (error) {
                console.error(error);
                console.log(e);
            }
            errorHandler({ data, submission: { ...submission, userMessage } });
        });
        sse.stream();
        return () => {
            const isCancelled = sse.readyState <= 1;
            sse.close();
            if (isCancelled) {
                const e = new Event('cancel');
                /* @ts-ignore */
                sse.dispatchEvent(e);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submission]);
}
