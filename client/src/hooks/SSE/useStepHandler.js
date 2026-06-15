import { useCallback, useRef } from 'react';
import { useRecoilCallback } from 'recoil';
import { Constants, StepTypes, StepEvents, ContentTypes, ToolCallTypes, getNonEmptyValue, } from 'librechat-data-provider';
import { foldSubagentEvent, foldSubagentEventIntoTicker, initSubagentAggregatorState, initSubagentTickerState, } from '~/utils/subagentContent';
import { subagentProgressByToolCallId } from '~/store';
import { MESSAGE_UPDATE_INTERVAL } from '~/common';
const isOAuthToolCallName = (name) => typeof name === 'string' && name.startsWith(`oauth${Constants.mcp_delimiter}`);
const isOAuthToolCallContent = (part) => {
    if (part?.type !== ContentTypes.TOOL_CALL || !('tool_call' in part)) {
        return false;
    }
    const { tool_call: toolCall } = part;
    const name = toolCall != null && 'name' in toolCall ? toolCall.name : undefined;
    return isOAuthToolCallName(name);
};
export default function useStepHandler({ setMessages, getMessages, announcePolite, lastAnnouncementTimeRef, }) {
    const toolCallIdMap = useRef(new Map());
    const messageMap = useRef(new Map());
    const stepMap = useRef(new Map());
    /** Buffer for deltas that arrive before their corresponding run step */
    const pendingDeltaBuffer = useRef(new Map());
    /** Coalesces rapid-fire summarize delta renders into a single rAF frame */
    const summarizeDeltaRaf = useRef(null);
    /**
     * Maps `SubagentUpdateEvent.subagentRunId` → parent `tool_call_id`.
     * Preferred source is `payload.parentToolCallId` (threaded through by the
     * SDK from `ToolRunnableConfig.toolCall.id`, deterministic). If a host
     * runs an older SDK that doesn't emit it, we fall back to a temporal
     * claim: the OLDEST unclaimed `subagent` tool call in the active message.
     * Forward (oldest-first) iteration matches the order tool calls are
     * created in, so concurrent spawns map in creation order.
     */
    const subagentRunToToolCallId = useRef(new Map());
    const claimedSubagentToolCallIds = useRef(new Set());
    /**
     * Buffers for envelopes that arrive before their `subagent` tool call is
     * reflected in `messageMap`. Keyed by `subagentRunId`. Once a tool call is
     * claimed we drain the buffer into the Recoil atom in arrival order.
     */
    const pendingSubagentBuffer = useRef(new Map());
    /**
     * Tracked atom keys so `clearStepMaps` can reset them. Without this, each
     * subagent invocation leaks an `events: SubagentUpdateEvent[]` array in the
     * `atomFamily` — atoms persist for the app lifetime.
     */
    const knownSubagentAtomKeys = useRef(new Set());
    const getCurrentMessages = useCallback((messages) => {
        const freshMessages = getMessages();
        return freshMessages && freshMessages.length >= messages.length ? freshMessages : messages;
    }, [getMessages]);
    /** Both content parts and ticker lines are aggregated incrementally
     *  into the atom as each `ON_SUBAGENT_UPDATE` arrives — we never
     *  retain the raw event array, so no rolling window is needed. A
     *  talkative subagent can emit thousands of deltas without growing
     *  memory past what the structural output requires. */
    /**
     * Attempts to resolve the parent `tool_call_id` for a subagent run, using
     * the SDK-provided `parentToolCallId` first and falling back to an
     * oldest-unclaimed temporal claim.
     */
    const resolveSubagentToolCallId = useCallback((payload) => {
        const cached = subagentRunToToolCallId.current.get(payload.subagentRunId);
        if (cached != null)
            return cached;
        if (payload.parentToolCallId) {
            subagentRunToToolCallId.current.set(payload.subagentRunId, payload.parentToolCallId);
            claimedSubagentToolCallIds.current.add(payload.parentToolCallId);
            return payload.parentToolCallId;
        }
        // Fallback — oldest unclaimed subagent tool call wins.
        for (const message of messageMap.current.values()) {
            const content = message.content;
            if (!Array.isArray(content))
                continue;
            for (let i = 0; i < content.length; i++) {
                const part = content[i];
                if (part?.type !== ContentTypes.TOOL_CALL)
                    continue;
                const tc = part[ContentTypes.TOOL_CALL];
                if (tc?.name === Constants.SUBAGENT &&
                    tc.id &&
                    !claimedSubagentToolCallIds.current.has(tc.id)) {
                    subagentRunToToolCallId.current.set(payload.subagentRunId, tc.id);
                    claimedSubagentToolCallIds.current.add(tc.id);
                    return tc.id;
                }
            }
        }
        return undefined;
    }, []);
    /**
     * Merges an incoming {@link SubagentUpdateEvent} into the Recoil atom bucket
     * keyed by the parent `tool_call_id`. Buffers early-arriving events whose
     * tool call is not yet mapped, and replays the buffer once correlation
     * completes.
     */
    const applySubagentUpdate = useRecoilCallback(({ set }) => (payload) => {
        const toolCallId = resolveSubagentToolCallId(payload);
        if (!toolCallId) {
            const queue = pendingSubagentBuffer.current.get(payload.subagentRunId) ?? [];
            queue.push(payload);
            pendingSubagentBuffer.current.set(payload.subagentRunId, queue);
            return;
        }
        const buffered = pendingSubagentBuffer.current.get(payload.subagentRunId);
        if (buffered && buffered.length > 0) {
            pendingSubagentBuffer.current.delete(payload.subagentRunId);
        }
        const toApply = buffered ? [...buffered, payload] : [payload];
        knownSubagentAtomKeys.current.add(toolCallId);
        set(subagentProgressByToolCallId(toolCallId), (prev) => {
            /** Fold the batch into both aggregators. Pure functions — they
             *  return a new reference only when something actually changed,
             *  so React bails out of unnecessary re-renders downstream. */
            let contentParts = prev?.contentParts ?? [];
            let aggregatorState = prev?.aggregatorState ?? initSubagentAggregatorState();
            let tickerState = prev?.tickerState ?? initSubagentTickerState();
            for (const event of toApply) {
                ({ parts: contentParts, state: aggregatorState } = foldSubagentEvent(contentParts, aggregatorState, event));
                tickerState = foldSubagentEventIntoTicker(tickerState, event);
            }
            const last = toApply[toApply.length - 1];
            return {
                subagentRunId: payload.subagentRunId,
                subagentType: payload.subagentType,
                subagentAgentId: payload.subagentAgentId ?? prev?.subagentAgentId,
                contentParts,
                aggregatorState,
                tickerState,
                status: last.phase,
                latestLabel: last.label ?? prev?.latestLabel,
            };
        });
    }, [resolveSubagentToolCallId]);
    /**
     * Resets all accumulated subagent Recoil state. Kept for conversation-
     * switch cleanup (see top-level hook usage) but NOT called from
     * `clearStepMaps` — the collapsed SubagentCall ticker and its dialog
     * read from these atoms to render the child's content parts, and we
     * want that history to remain visible after the stream ends so the
     * user can reopen the dialog for auditability. The atoms are bounded
     * per-call (200-event cap) and per-conversation (one atom per
     * subagent spawn), so growth is proportional to messages — the same
     * growth profile as the rest of the conversation state.
     */
    const resetSubagentAtoms = useRecoilCallback(({ reset }) => () => {
        for (const toolCallId of knownSubagentAtomKeys.current) {
            reset(subagentProgressByToolCallId(toolCallId));
        }
        knownSubagentAtomKeys.current.clear();
    }, []);
    /**
     * Calculate content index for a run step.
     * For edited content scenarios, offset by initialContent length.
     */
    const calculateContentIndex = useCallback((serverIndex, initialContent, incomingContentType, existingContent) => {
        /** Only apply -1 adjustment for TEXT or THINK types when they match existing content */
        if (initialContent.length > 0 &&
            (incomingContentType === ContentTypes.TEXT || incomingContentType === ContentTypes.THINK)) {
            const targetIndex = serverIndex + initialContent.length - 1;
            const existingType = existingContent?.[targetIndex]?.type;
            if (existingType === incomingContentType) {
                return targetIndex;
            }
        }
        return serverIndex + initialContent.length;
    }, []);
    /** Metadata to propagate onto content parts for parallel rendering - uses ContentMetadata from data-provider */
    const updateContent = (message, index, contentPart, finalUpdate = false, metadata) => {
        const contentType = contentPart.type ?? '';
        if (!contentType) {
            console.warn('No content type found in content part');
            return message;
        }
        const incomingOAuthToolCall = contentType === ContentTypes.TOOL_CALL &&
            'tool_call' in contentPart &&
            isOAuthToolCallName(contentPart.tool_call?.name);
        let updatedContent = [...(message.content || [])];
        const oauthPromptOccupiesSlot = isOAuthToolCallContent(updatedContent[index]);
        if (!incomingOAuthToolCall && oauthPromptOccupiesSlot) {
            updatedContent = updatedContent.filter((part) => !isOAuthToolCallContent(part));
        }
        if (!updatedContent[index] && contentType !== ContentTypes.TOOL_CALL) {
            updatedContent[index] = { type: contentPart.type };
        }
        /** Prevent overwriting an existing content part with a different type */
        const existingType = updatedContent[index]?.type ?? '';
        if (existingType &&
            existingType !== contentType &&
            !contentType.startsWith(existingType) &&
            !existingType.startsWith(contentType)) {
            console.warn('Content type mismatch', { existingType, contentType, index });
            return message;
        }
        if (contentType.startsWith(ContentTypes.TEXT) &&
            ContentTypes.TEXT in contentPart &&
            typeof contentPart.text === 'string') {
            const currentContent = updatedContent[index];
            const update = {
                type: ContentTypes.TEXT,
                text: (currentContent.text || '') + contentPart.text,
            };
            if ('tool_call_ids' in contentPart && contentPart.tool_call_ids != null) {
                update.tool_call_ids = contentPart.tool_call_ids;
            }
            updatedContent[index] = update;
        }
        else if (contentType.startsWith(ContentTypes.AGENT_UPDATE) &&
            ContentTypes.AGENT_UPDATE in contentPart &&
            contentPart.agent_update) {
            const update = {
                type: ContentTypes.AGENT_UPDATE,
                agent_update: contentPart.agent_update,
            };
            updatedContent[index] = update;
        }
        else if (contentType.startsWith(ContentTypes.THINK) &&
            ContentTypes.THINK in contentPart &&
            typeof contentPart.think === 'string') {
            const currentContent = updatedContent[index];
            const update = {
                type: ContentTypes.THINK,
                think: (currentContent.think || '') + contentPart.think,
            };
            updatedContent[index] = update;
        }
        else if (contentType === ContentTypes.IMAGE_URL && 'image_url' in contentPart) {
            const currentContent = updatedContent[index];
            updatedContent[index] = {
                ...currentContent,
            };
        }
        else if (contentType === ContentTypes.SUMMARY) {
            const currentSummary = updatedContent[index];
            const incoming = contentPart;
            updatedContent[index] = {
                ...incoming,
                content: [...(currentSummary?.content ?? []), ...(incoming.content ?? [])],
            };
        }
        else if (contentType === ContentTypes.TOOL_CALL && 'tool_call' in contentPart) {
            const existingContent = updatedContent[index];
            const existingToolCall = existingContent?.tool_call;
            const toolCallArgs = contentPart.tool_call.args;
            /** When args are a valid object, they are likely already invoked */
            let args = finalUpdate ||
                typeof existingToolCall?.args === 'object' ||
                typeof toolCallArgs === 'object'
                ? contentPart.tool_call.args
                : (existingToolCall?.args ?? '') + (toolCallArgs ?? '');
            /** Preserve previously streamed args when final update omits them */
            if (finalUpdate && args == null && existingToolCall?.args != null) {
                args = existingToolCall.args;
            }
            const id = getNonEmptyValue([contentPart.tool_call.id, existingToolCall?.id]) ?? '';
            const name = getNonEmptyValue([contentPart.tool_call.name, existingToolCall?.name]) ?? '';
            const newToolCall = {
                id,
                name,
                args,
                type: ToolCallTypes.TOOL_CALL,
                auth: contentPart.tool_call.auth,
                expires_at: contentPart.tool_call.expires_at,
            };
            if (finalUpdate) {
                newToolCall.progress = 1;
                newToolCall.output = contentPart.tool_call.output;
            }
            updatedContent[index] = {
                type: ContentTypes.TOOL_CALL,
                tool_call: newToolCall,
            };
        }
        // Apply metadata to the content part for parallel rendering
        // This must happen AFTER all content updates to avoid being overwritten
        if (metadata?.agentId != null || metadata?.groupId != null) {
            const part = updatedContent[index];
            if (metadata.agentId != null) {
                part.agentId = metadata.agentId;
            }
            if (metadata.groupId != null) {
                part.groupId = metadata.groupId;
            }
        }
        return { ...message, content: updatedContent };
    };
    /** Extract metadata from runStep for parallel content rendering */
    const getStepMetadata = (runStep) => {
        if (!runStep?.agentId && runStep?.groupId == null) {
            return undefined;
        }
        const metadata = {
            agentId: runStep.agentId,
            // Only set groupId when explicitly provided by the server
            // Sequential handoffs have agentId but no groupId
            // Parallel execution has both agentId AND groupId
            groupId: runStep.groupId,
        };
        return metadata;
    };
    const stepHandler = useCallback((stepEvent, submission) => {
        const submissionMessages = submission.messages ?? [];
        const getEventMessages = (candidateMessages) => submission.isRegenerate ? candidateMessages : getCurrentMessages(candidateMessages);
        const messages = getEventMessages(submissionMessages);
        const { userMessage } = submission;
        const getRegenerateResponseIds = (responseMessageId) => {
            const ids = new Set();
            const addId = (id) => {
                if (!id) {
                    return;
                }
                ids.add(id);
                ids.add(id.replace(/_+$/, ''));
            };
            addId(responseMessageId);
            addId(submission.initialResponse?.messageId);
            addId(submission.userMessage?.responseMessageId);
            return ids;
        };
        const shouldRemoveRegenerateResponse = (message, responseMessageId) => submission.isRegenerate &&
            !message.isCreatedByUser &&
            getRegenerateResponseIds(responseMessageId).has(message.messageId);
        const shouldRemoveInitialResponse = (message, responseMessageId) => {
            const initialResponseId = submission.initialResponse?.messageId;
            return (!submission.isRegenerate &&
                !message.isCreatedByUser &&
                initialResponseId != null &&
                initialResponseId !== responseMessageId &&
                message.messageId === initialResponseId &&
                message.parentMessageId === userMessage.messageId);
        };
        const ensureUserMessagePresent = (candidateMessages, responseMessageId) => {
            if (submission.isRegenerate ||
                !userMessage?.messageId ||
                candidateMessages.some((message) => message.messageId === userMessage.messageId)) {
                return candidateMessages;
            }
            const responseIndex = candidateMessages.findIndex((message) => message.messageId === responseMessageId);
            if (responseIndex < 0) {
                return [...candidateMessages, userMessage];
            }
            const nextMessages = [...candidateMessages];
            nextMessages.splice(responseIndex, 0, userMessage);
            return nextMessages;
        };
        const getResponseBaseMessages = (candidateMessages, responseMessageId, ensureUserMessage = false) => {
            const currentMessages = getEventMessages(candidateMessages);
            if (!submission.isRegenerate) {
                const nextMessages = currentMessages.filter((message) => !shouldRemoveInitialResponse(message, responseMessageId));
                return ensureUserMessage
                    ? ensureUserMessagePresent(nextMessages, responseMessageId)
                    : nextMessages;
            }
            return currentMessages.filter((message) => !shouldRemoveRegenerateResponse(message, responseMessageId));
        };
        const mergeResponseMessage = (candidateMessages, updatedResponse, responseMessageId, options) => {
            const currentMessages = getResponseBaseMessages(candidateMessages, responseMessageId, options?.ensureUserMessage === true);
            const hasResponseMessage = currentMessages.some((msg) => msg.messageId === responseMessageId);
            return hasResponseMessage
                ? currentMessages.map((msg) => msg.messageId === responseMessageId ? updatedResponse : msg)
                : [...currentMessages, updatedResponse];
        };
        let parentMessageId = submission.isRegenerate && submission.initialResponse?.parentMessageId
            ? submission.initialResponse.parentMessageId
            : userMessage.messageId;
        const currentTime = Date.now();
        if (currentTime - lastAnnouncementTimeRef.current > MESSAGE_UPDATE_INTERVAL) {
            announcePolite({ message: 'composing', isStatus: true });
            lastAnnouncementTimeRef.current = currentTime;
        }
        let initialContent = [];
        // For editedContent scenarios, use the initial response content for index offsetting
        if (submission?.editedContent != null) {
            initialContent = submission?.initialResponse?.content ?? initialContent;
        }
        if (stepEvent.event === StepEvents.ON_RUN_STEP) {
            const runStep = stepEvent.data;
            let responseMessageId = runStep.runId ?? '';
            if (responseMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                responseMessageId = submission?.initialResponse?.messageId ?? '';
                parentMessageId = submission?.initialResponse?.parentMessageId ?? '';
            }
            if (!responseMessageId) {
                console.warn('No message id found in run step event');
                return;
            }
            stepMap.current.set(runStep.id, runStep);
            // Calculate content index - use server index, offset by initialContent for edit scenarios
            const contentIndex = runStep.index + initialContent.length;
            let response = messageMap.current.get(responseMessageId);
            if (!response) {
                // Find the actual response message. Regenerate submissions can target
                // an earlier branch while the visible history still ends at a later
                // assistant message, so never seed a regenerated response from the
                // conversation tail.
                const lastMessage = messages[messages.length - 1];
                const responseMessage = !submission.isRegenerate && lastMessage && !lastMessage.isCreatedByUser
                    ? lastMessage
                    : submission?.initialResponse;
                // For edit scenarios, initialContent IS the complete starting content (not to be merged)
                // For resume scenarios (no editedContent), initialContent is empty and we use existingContent
                const existingContent = responseMessage?.content ?? [];
                const mergedContent = initialContent.length > 0 ? initialContent : existingContent;
                response = {
                    ...responseMessage,
                    parentMessageId,
                    conversationId: userMessage.conversationId,
                    messageId: responseMessageId,
                    content: mergedContent,
                };
                messageMap.current.set(responseMessageId, response);
                // Get fresh messages to handle multi-tab scenarios where messages may have loaded
                // after this handler started (Tab 2 may have more complete history now)
                const currentMessages = getResponseBaseMessages(messages, responseMessageId, true);
                // Remove any existing response placeholder
                let updatedMessages = currentMessages.filter((message) => message.messageId !== responseMessageId &&
                    !shouldRemoveRegenerateResponse(message, responseMessageId) &&
                    !shouldRemoveInitialResponse(message, responseMessageId));
                // Ensure userMessage is present (multi-tab: Tab 2 may not have it yet).
                // Regenerate reuses an existing user turn; its submission userMessage is only
                // a transport placeholder and must not become a new visible branch.
                if (!submission.isRegenerate &&
                    !updatedMessages.some((m) => m.messageId === userMessage.messageId)) {
                    updatedMessages = [...updatedMessages, userMessage];
                }
                setMessages([...updatedMessages, response]);
            }
            // Store tool call IDs if present
            if (runStep.stepDetails.type === StepTypes.TOOL_CALLS) {
                let updatedResponse = { ...response };
                runStep.stepDetails.tool_calls.forEach((toolCall) => {
                    const toolCallId = toolCall.id ?? '';
                    if ('id' in toolCall && toolCallId) {
                        toolCallIdMap.current.set(runStep.id, toolCallId);
                    }
                    const contentPart = {
                        type: ContentTypes.TOOL_CALL,
                        tool_call: {
                            name: toolCall.name ?? '',
                            args: toolCall.args,
                            id: toolCallId,
                        },
                    };
                    // Use the pre-calculated contentIndex which handles parallel agent indexing
                    updatedResponse = updateContent(updatedResponse, contentIndex, contentPart, false, getStepMetadata(runStep));
                });
                messageMap.current.set(responseMessageId, updatedResponse);
                setMessages(mergeResponseMessage(messages, updatedResponse, responseMessageId, {
                    ensureUserMessage: true,
                }));
            }
            if (runStep.summary != null) {
                const summaryPart = {
                    type: ContentTypes.SUMMARY,
                    content: [],
                    summarizing: true,
                    model: runStep.summary.model,
                    provider: runStep.summary.provider,
                };
                let updatedResponse = { ...(messageMap.current.get(responseMessageId) ?? response) };
                updatedResponse = updateContent(updatedResponse, contentIndex, summaryPart, false, getStepMetadata(runStep));
                messageMap.current.set(responseMessageId, updatedResponse);
                setMessages(mergeResponseMessage(messages, updatedResponse, responseMessageId, {
                    ensureUserMessage: true,
                }));
            }
            const bufferedDeltas = pendingDeltaBuffer.current.get(runStep.id);
            if (bufferedDeltas && bufferedDeltas.length > 0) {
                pendingDeltaBuffer.current.delete(runStep.id);
                for (const bufferedDelta of bufferedDeltas) {
                    stepHandler(bufferedDelta, submission);
                }
            }
        }
        else if (stepEvent.event === StepEvents.ON_AGENT_UPDATE) {
            const { agent_update } = stepEvent.data;
            let responseMessageId = agent_update.runId || '';
            if (responseMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                responseMessageId = submission?.initialResponse?.messageId ?? '';
                parentMessageId = submission?.initialResponse?.parentMessageId ?? '';
            }
            if (!responseMessageId) {
                console.warn('No message id found in agent update event');
                return;
            }
            const response = messageMap.current.get(responseMessageId);
            if (response) {
                // Agent updates don't need index adjustment
                const currentIndex = agent_update.index + initialContent.length;
                // Agent updates carry their own agentId - use default groupId if agentId is present
                const agentUpdateMeta = agent_update.agentId
                    ? { agentId: agent_update.agentId, groupId: 1 }
                    : undefined;
                const updatedResponse = updateContent(response, currentIndex, stepEvent.data, false, agentUpdateMeta);
                messageMap.current.set(responseMessageId, updatedResponse);
                setMessages(mergeResponseMessage(messages, updatedResponse, responseMessageId, {
                    ensureUserMessage: true,
                }));
            }
        }
        else if (stepEvent.event === StepEvents.ON_MESSAGE_DELTA) {
            const messageDelta = stepEvent.data;
            const runStep = stepMap.current.get(messageDelta.id);
            let responseMessageId = runStep?.runId ?? '';
            if (responseMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                responseMessageId = submission?.initialResponse?.messageId ?? '';
                parentMessageId = submission?.initialResponse?.parentMessageId ?? '';
            }
            if (!runStep || !responseMessageId) {
                const buffer = pendingDeltaBuffer.current.get(messageDelta.id) ?? [];
                buffer.push({ event: StepEvents.ON_MESSAGE_DELTA, data: messageDelta });
                pendingDeltaBuffer.current.set(messageDelta.id, buffer);
                return;
            }
            const response = messageMap.current.get(responseMessageId);
            if (response && messageDelta.delta.content) {
                const contentPart = Array.isArray(messageDelta.delta.content)
                    ? messageDelta.delta.content[0]
                    : messageDelta.delta.content;
                if (contentPart == null) {
                    return;
                }
                const currentIndex = calculateContentIndex(runStep.index, initialContent, contentPart.type || '', response.content);
                const updatedResponse = updateContent(response, currentIndex, contentPart, false, getStepMetadata(runStep));
                messageMap.current.set(responseMessageId, updatedResponse);
                setMessages(mergeResponseMessage(messages, updatedResponse, responseMessageId, {
                    ensureUserMessage: true,
                }));
            }
        }
        else if (stepEvent.event === StepEvents.ON_REASONING_DELTA) {
            const reasoningDelta = stepEvent.data;
            const runStep = stepMap.current.get(reasoningDelta.id);
            let responseMessageId = runStep?.runId ?? '';
            if (responseMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                responseMessageId = submission?.initialResponse?.messageId ?? '';
                parentMessageId = submission?.initialResponse?.parentMessageId ?? '';
            }
            if (!runStep || !responseMessageId) {
                const buffer = pendingDeltaBuffer.current.get(reasoningDelta.id) ?? [];
                buffer.push({ event: StepEvents.ON_REASONING_DELTA, data: reasoningDelta });
                pendingDeltaBuffer.current.set(reasoningDelta.id, buffer);
                return;
            }
            const response = messageMap.current.get(responseMessageId);
            if (response && reasoningDelta.delta.content != null) {
                const contentPart = Array.isArray(reasoningDelta.delta.content)
                    ? reasoningDelta.delta.content[0]
                    : reasoningDelta.delta.content;
                if (contentPart == null) {
                    return;
                }
                const currentIndex = calculateContentIndex(runStep.index, initialContent, contentPart.type || '', response.content);
                const updatedResponse = updateContent(response, currentIndex, contentPart, false, getStepMetadata(runStep));
                messageMap.current.set(responseMessageId, updatedResponse);
                setMessages(mergeResponseMessage(messages, updatedResponse, responseMessageId, {
                    ensureUserMessage: true,
                }));
            }
        }
        else if (stepEvent.event === StepEvents.ON_RUN_STEP_DELTA) {
            const runStepDelta = stepEvent.data;
            const runStep = stepMap.current.get(runStepDelta.id);
            let responseMessageId = runStep?.runId ?? '';
            if (responseMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                responseMessageId = submission?.initialResponse?.messageId ?? '';
                parentMessageId = submission?.initialResponse?.parentMessageId ?? '';
            }
            if (!runStep || !responseMessageId) {
                const buffer = pendingDeltaBuffer.current.get(runStepDelta.id) ?? [];
                buffer.push({ event: StepEvents.ON_RUN_STEP_DELTA, data: runStepDelta });
                pendingDeltaBuffer.current.set(runStepDelta.id, buffer);
                return;
            }
            const response = messageMap.current.get(responseMessageId);
            if (response &&
                runStepDelta.delta.type === StepTypes.TOOL_CALLS &&
                runStepDelta.delta.tool_calls) {
                let updatedResponse = { ...response };
                runStepDelta.delta.tool_calls.forEach((toolCallDelta) => {
                    const toolCallId = toolCallIdMap.current.get(runStepDelta.id) ?? '';
                    const contentPart = {
                        type: ContentTypes.TOOL_CALL,
                        tool_call: {
                            name: toolCallDelta.name ?? '',
                            args: toolCallDelta.args ?? '',
                            id: toolCallId,
                        },
                    };
                    if (runStepDelta.delta.auth != null) {
                        contentPart.tool_call.auth = runStepDelta.delta.auth;
                        contentPart.tool_call.expires_at = runStepDelta.delta.expires_at;
                    }
                    // Use server's index, offset by initialContent for edit scenarios
                    const currentIndex = runStep.index + initialContent.length;
                    updatedResponse = updateContent(updatedResponse, currentIndex, contentPart, false, getStepMetadata(runStep));
                });
                messageMap.current.set(responseMessageId, updatedResponse);
                setMessages(mergeResponseMessage(messages, updatedResponse, responseMessageId, {
                    ensureUserMessage: true,
                }));
            }
        }
        else if (stepEvent.event === StepEvents.ON_RUN_STEP_COMPLETED) {
            const { result } = stepEvent.data;
            const { id: stepId } = result;
            const runStep = stepMap.current.get(stepId);
            let responseMessageId = runStep?.runId ?? '';
            if (responseMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                responseMessageId = submission?.initialResponse?.messageId ?? '';
                parentMessageId = submission?.initialResponse?.parentMessageId ?? '';
            }
            if (!runStep || !responseMessageId) {
                console.warn('No run step or runId found for completed tool call event');
                return;
            }
            const response = messageMap.current.get(responseMessageId);
            if (response) {
                let updatedResponse = { ...response };
                const contentPart = {
                    type: ContentTypes.TOOL_CALL,
                    tool_call: result.tool_call,
                };
                // Use server's index, offset by initialContent for edit scenarios
                const currentIndex = runStep.index + initialContent.length;
                updatedResponse = updateContent(updatedResponse, currentIndex, contentPart, true, getStepMetadata(runStep));
                messageMap.current.set(responseMessageId, updatedResponse);
                setMessages(mergeResponseMessage(messages, updatedResponse, responseMessageId, {
                    ensureUserMessage: true,
                }));
            }
        }
        else if (stepEvent.event === StepEvents.ON_SUBAGENT_UPDATE) {
            applySubagentUpdate(stepEvent.data);
        }
        else if (stepEvent.event === StepEvents.ON_SUMMARIZE_START) {
            announcePolite({ message: 'summarize_started', isStatus: true });
        }
        else if (stepEvent.event === StepEvents.ON_SUMMARIZE_DELTA) {
            const deltaData = stepEvent.data;
            const runStep = stepMap.current.get(deltaData.id);
            let responseMessageId = runStep?.runId ?? '';
            if (responseMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                responseMessageId = submission?.initialResponse?.messageId ?? '';
                parentMessageId = submission?.initialResponse?.parentMessageId ?? '';
            }
            if (!runStep || !responseMessageId) {
                const buffer = pendingDeltaBuffer.current.get(deltaData.id) ?? [];
                buffer.push({ event: StepEvents.ON_SUMMARIZE_DELTA, data: deltaData });
                pendingDeltaBuffer.current.set(deltaData.id, buffer);
                return;
            }
            const response = messageMap.current.get(responseMessageId);
            if (response) {
                const contentPart = {
                    ...deltaData.delta.summary,
                    summarizing: true,
                };
                const contentIndex = runStep.index + initialContent.length;
                const updatedResponse = updateContent(response, contentIndex, contentPart, false, getStepMetadata(runStep));
                messageMap.current.set(responseMessageId, updatedResponse);
                if (summarizeDeltaRaf.current == null) {
                    summarizeDeltaRaf.current = requestAnimationFrame(() => {
                        summarizeDeltaRaf.current = null;
                        const latest = messageMap.current.get(responseMessageId);
                        if (latest) {
                            const currentMessages = submission.isRegenerate ? messages : getMessages() || [];
                            setMessages(mergeResponseMessage(currentMessages, latest, responseMessageId));
                        }
                    });
                }
            }
        }
        else if (stepEvent.event === StepEvents.ON_SUMMARIZE_COMPLETE) {
            const completeData = stepEvent.data;
            const completeRunStep = stepMap.current.get(completeData.id);
            let completeMessageId = completeRunStep?.runId ?? '';
            if (completeMessageId === Constants.USE_PRELIM_RESPONSE_MESSAGE_ID) {
                completeMessageId = submission?.initialResponse?.messageId ?? '';
            }
            const targetMessage = messageMap.current.get(completeMessageId);
            if (!targetMessage || !Array.isArray(targetMessage.content)) {
                return;
            }
            if (completeData.error) {
                const filtered = targetMessage.content.filter((part) => part?.type !== ContentTypes.SUMMARY || !part.summarizing);
                if (filtered.length !== targetMessage.content.length) {
                    announcePolite({ message: 'summarize_failed', isStatus: true });
                    const cleaned = { ...targetMessage, content: filtered };
                    const currentMessages = submission.isRegenerate ? messages : getMessages() || [];
                    messageMap.current.set(completeMessageId, cleaned);
                    setMessages(mergeResponseMessage(currentMessages, cleaned, completeMessageId));
                }
            }
            else {
                let didFinalize = false;
                const updatedContent = targetMessage.content.map((part) => {
                    if (part?.type === ContentTypes.SUMMARY && part.summarizing) {
                        didFinalize = true;
                        if (!completeData.summary) {
                            return { ...part, summarizing: false };
                        }
                        return { ...completeData.summary, summarizing: false };
                    }
                    return part;
                });
                if (didFinalize) {
                    announcePolite({ message: 'summarize_completed', isStatus: true });
                    const finalized = { ...targetMessage, content: updatedContent };
                    const currentMessages = submission.isRegenerate ? messages : getMessages() || [];
                    messageMap.current.set(completeMessageId, finalized);
                    setMessages(mergeResponseMessage(currentMessages, finalized, completeMessageId));
                }
            }
        }
        else {
            const _exhaustive = stepEvent;
            console.warn('Unhandled step event', _exhaustive.event);
        }
    }, [
        getMessages,
        lastAnnouncementTimeRef,
        announcePolite,
        setMessages,
        calculateContentIndex,
        getCurrentMessages,
        applySubagentUpdate,
    ]);
    const clearStepMaps = useCallback(() => {
        if (summarizeDeltaRaf.current != null) {
            cancelAnimationFrame(summarizeDeltaRaf.current);
            summarizeDeltaRaf.current = null;
        }
        toolCallIdMap.current.clear();
        messageMap.current.clear();
        stepMap.current.clear();
        pendingDeltaBuffer.current.clear();
        subagentRunToToolCallId.current.clear();
        claimedSubagentToolCallIds.current.clear();
        pendingSubagentBuffer.current.clear();
        /** Intentionally NOT calling `resetSubagentAtoms()` here — users need
         *  to be able to reopen the SubagentCall dialog after completion to
         *  audit what the child did. `resetSubagentAtoms` is returned below
         *  so callers can wipe atoms on conversation-switch (see
         *  `useEventHandlers`) — that's the correct cleanup boundary:
         *  persisted `subagent_content` takes over for historical messages
         *  once the conversation is saved, and we prevent unbounded
         *  atomFamily growth across multi-conversation sessions. */
    }, []);
    /**
     * Sync a message into the step handler's messageMap.
     * Call this after receiving sync event to ensure subsequent deltas
     * build on the synced content, not stale content.
     */
    const syncStepMessage = useCallback((message) => {
        if (message?.messageId) {
            messageMap.current.set(message.messageId, { ...message });
        }
    }, []);
    return { stepHandler, clearStepMaps, resetSubagentAtoms, syncStepMessage };
}
