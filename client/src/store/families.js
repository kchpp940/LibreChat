import { useEffect } from 'react';
import { createSearchParams } from 'react-router-dom';
import { atom, selector, atomFamily, DefaultValue, selectorFamily, useRecoilValue, useSetRecoilState, useRecoilCallback, } from 'recoil';
import { LocalStorageKeys, isEphemeralAgentId, Constants } from 'librechat-data-provider';
import { clearModelForNonEphemeralAgent, createChatSearchParams, storeEndpointSettings, logger, } from '~/utils';
import { useSetConvoContext } from '~/Providers/SetConvoContext';
import { chatStreamFamily } from './chatStream/atoms';
const submissionKeysAtom = atom({
    key: 'submissionKeys',
    default: [],
});
const submissionByIndex = atomFamily({
    key: 'submissionByIndex',
    default: null,
});
const submissionKeysSelector = selector({
    key: 'submissionKeysSelector',
    get: ({ get }) => {
        const keys = get(conversationKeysAtom);
        return keys.filter((key) => get(submissionByIndex(key)) !== null);
    },
    set: ({ set }, newKeys) => {
        logger.log('setting submissionKeysAtom', newKeys);
        set(submissionKeysAtom, newKeys);
    },
});
const conversationByIndex = atomFamily({
    key: 'conversationByIndex',
    default: null,
    effects: [
        ({ onSet, node }) => {
            onSet(async (newValue, oldValue) => {
                const index = Number(node.key.split('__')[1]);
                logger.log('conversation', 'Setting conversation:', { index, newValue, oldValue });
                if (newValue?.assistant_id != null && newValue.assistant_id) {
                    localStorage.setItem(`${LocalStorageKeys.ASST_ID_PREFIX}${index}${newValue.endpoint}`, newValue.assistant_id);
                }
                if (newValue?.agent_id != null && !isEphemeralAgentId(newValue.agent_id)) {
                    localStorage.setItem(`${LocalStorageKeys.AGENT_ID_PREFIX}${index}`, newValue.agent_id);
                }
                if (newValue?.spec != null && newValue.spec) {
                    localStorage.setItem(LocalStorageKeys.LAST_SPEC, newValue.spec);
                }
                if (newValue?.tools && Array.isArray(newValue.tools)) {
                    localStorage.setItem(LocalStorageKeys.LAST_TOOLS, JSON.stringify(newValue.tools.filter((el) => !!el)));
                }
                if (!newValue) {
                    return;
                }
                storeEndpointSettings(newValue);
                const convoToStore = { ...newValue };
                clearModelForNonEphemeralAgent(convoToStore);
                localStorage.setItem(`${LocalStorageKeys.LAST_CONVO_SETUP}_${index}`, JSON.stringify(convoToStore));
                const disableParams = newValue.disableParams === true;
                const shouldUpdateParams = index === 0 &&
                    !disableParams &&
                    newValue.createdAt === '' &&
                    JSON.stringify(newValue) !== JSON.stringify(oldValue) &&
                    oldValue?.conversationId === Constants.NEW_CONVO;
                if (shouldUpdateParams) {
                    const newParams = createChatSearchParams(newValue);
                    if (newValue.chatProjectId) {
                        newParams.set('projectId', newValue.chatProjectId);
                    }
                    const searchParams = createSearchParams(newParams);
                    const url = `${window.location.pathname}?${searchParams.toString()}`;
                    window.history.pushState({}, '', url);
                }
            });
        },
    ],
});
const filesByIndex = atomFamily({
    key: 'filesByIndex',
    default: new Map(),
});
const conversationKeysAtom = atom({
    key: 'conversationKeys',
    default: [],
});
const allConversationsSelector = selector({
    key: 'allConversationsSelector',
    get: ({ get }) => {
        const keys = get(conversationKeysAtom);
        return keys.map((key) => get(conversationByIndex(key))).map((convo) => convo?.conversationId);
    },
});
const conversationIdByIndex = selectorFamily({
    key: 'conversationIdByIndex',
    get: (index) => ({ get }) => get(conversationByIndex(index))?.conversationId ?? null,
});
const conversationEndpointByIndex = selectorFamily({
    key: 'conversationEndpointByIndex',
    get: (index) => ({ get }) => get(conversationByIndex(index))?.endpoint ?? null,
});
/** Returns `endpointType ?? endpoint`, matching the effective endpoint used for feature gating. */
const effectiveEndpointByIndex = selectorFamily({
    key: 'effectiveEndpointByIndex',
    get: (index) => ({ get }) => {
        const convo = get(conversationByIndex(index));
        return convo?.endpointType ?? convo?.endpoint ?? null;
    },
});
const conversationModelByIndex = selectorFamily({
    key: 'conversationModelByIndex',
    get: (index) => ({ get }) => get(conversationByIndex(index))?.model ?? null,
});
const conversationSpecByIndex = selectorFamily({
    key: 'conversationSpecByIndex',
    get: (index) => ({ get }) => get(conversationByIndex(index))?.spec ?? null,
});
const conversationAgentIdByIndex = selectorFamily({
    key: 'conversationAgentIdByIndex',
    get: (index) => ({ get }) => get(conversationByIndex(index))?.agent_id ?? null,
});
const conversationAssistantIdByIndex = selectorFamily({
    key: 'conversationAssistantIdByIndex',
    get: (index) => ({ get }) => get(conversationByIndex(index))?.assistant_id ?? null,
});
const presetByIndex = atomFamily({
    key: 'presetByIndex',
    default: null,
});
const textByIndex = atomFamily({
    key: 'textByIndex',
    default: '',
});
const showStopButtonByIndex = selectorFamily({
    key: 'showStopButtonByIndex',
    get: (index) => ({ get }) => get(chatStreamFamily(index)).showStopButton,
    set: (index) => ({ set, reset }, newValue) => {
        if (newValue instanceof DefaultValue) {
            reset(chatStreamFamily(index));
            return;
        }
        set(chatStreamFamily(index), (prev) => ({
            ...prev,
            showStopButton: newValue,
            updatedAt: Date.now(),
        }));
    },
});
const abortScrollFamily = selectorFamily({
    key: 'abortScrollByIndex',
    get: (index) => ({ get }) => get(chatStreamFamily(index)).abortScroll,
    set: (index) => ({ set, reset }, newValue) => {
        if (newValue instanceof DefaultValue) {
            reset(chatStreamFamily(index));
            return;
        }
        set(chatStreamFamily(index), (prev) => ({
            ...prev,
            abortScroll: newValue,
            updatedAt: Date.now(),
        }));
    },
});
const isSubmittingFamily = selectorFamily({
    key: 'isSubmittingByIndex',
    get: (index) => ({ get }) => {
        const state = get(chatStreamFamily(index));
        return state.status === 'submitting' ||
            state.status === 'streaming' ||
            state.status === 'reconnecting' ||
            state.status === 'resumed';
    },
    set: (index) => ({ set, reset }, newValue) => {
        if (newValue instanceof DefaultValue) {
            reset(chatStreamFamily(index));
            return;
        }
        set(chatStreamFamily(index), (prev) => {
            const isCurrentlyRunning = prev.status === 'submitting' ||
                prev.status === 'streaming' ||
                prev.status === 'reconnecting' ||
                prev.status === 'resumed';
            if (newValue && !isCurrentlyRunning) {
                return { ...prev, status: 'submitting', showStopButton: true, updatedAt: Date.now() };
            }
            if (!newValue && isCurrentlyRunning) {
                return { ...prev, status: 'idle', showStopButton: false, updatedAt: Date.now() };
            }
            return prev;
        });
    },
});
const anySubmittingSelector = selector({
    key: 'anySubmittingSelector',
    get: ({ get }) => {
        const keys = get(conversationKeysAtom);
        return keys.some((key) => get(isSubmittingFamily(key)) === true);
    },
});
const optionSettingsFamily = atomFamily({
    key: 'optionSettingsByIndex',
    default: {},
});
const showPopoverFamily = atomFamily({
    key: 'showPopoverByIndex',
    default: false,
});
const activePromptByIndex = atomFamily({
    key: 'activePromptByIndex',
    default: undefined,
});
const showMentionPopoverFamily = atomFamily({
    key: 'showMentionPopoverByIndex',
    default: false,
});
const showPlusPopoverFamily = atomFamily({
    key: 'showPlusPopoverByIndex',
    default: false,
});
const showPromptsPopoverFamily = atomFamily({
    key: 'showPromptsPopoverByIndex',
    default: false,
});
const showSkillsPopoverFamily = atomFamily({
    key: 'showSkillsPopoverByIndex',
    default: false,
});
/**
 * Per-conversation queue of skill names the user invoked manually via the
 * `$` popover for the next submission. Structured channel that the submit
 * pipeline (`useChatFunctions.ask`) drains and pins onto the user message's
 * `manualSkills` field (also echoed at the top of the payload for the
 * runtime resolver), then resets to `[]`. Compose-time chips above the
 * textarea read this atom directly so users see (and can dismiss) their
 * current selection before hitting send.
 */
const pendingManualSkillsByConvoId = atomFamily({
    key: 'pendingManualSkillsByConvoId',
    default: [],
});
const globalAudioURLFamily = atomFamily({
    key: 'globalAudioURLByIndex',
    default: null,
});
const globalAudioFetchingFamily = atomFamily({
    key: 'globalAudioisFetchingByIndex',
    default: false,
});
const globalAudioPlayingFamily = atomFamily({
    key: 'globalAudioisPlayingByIndex',
    default: false,
});
const activeRunFamily = selectorFamily({
    key: 'activeRunByIndex',
    get: (index) => ({ get }) => index != null ? get(chatStreamFamily(index)).activeRunId : null,
    set: (index) => ({ set, reset }, newValue) => {
        if (index == null) {
            return;
        }
        if (newValue instanceof DefaultValue) {
            reset(chatStreamFamily(index));
            return;
        }
        set(chatStreamFamily(index), (prev) => ({
            ...prev,
            activeRunId: newValue,
            updatedAt: Date.now(),
        }));
    },
});
const audioRunFamily = atomFamily({
    key: 'audioRunByIndex',
    default: null,
});
const messagesSiblingIdxFamily = atomFamily({
    key: 'messagesSiblingIdx',
    default: 0,
});
function useCreateConversationAtom(key) {
    const hasSetConversation = useSetConvoContext();
    const setKeys = useSetRecoilState(conversationKeysAtom);
    const conversation = useRecoilValue(conversationByIndex(key));
    const setConversation = useSetRecoilState(conversationByIndex(key));
    useEffect(() => {
        setKeys((prevKeys) => {
            if (prevKeys.includes(key)) {
                return prevKeys;
            }
            return [...prevKeys, key];
        });
    }, [key, setKeys]);
    return { hasSetConversation, conversation, setConversation };
}
function useSetConversationAtom(key) {
    const { setConversation } = useCreateConversationAtom(key);
    return { setConversation };
}
function useClearConvoState() {
    /** Clears all active conversations. Pass `true` to skip the first or root conversation */
    const clearAllConversations = useRecoilCallback(({ reset, snapshot }) => async (skipFirst) => {
        const conversationKeys = await snapshot.getPromise(conversationKeysAtom);
        for (const conversationKey of conversationKeys) {
            if (skipFirst === true && conversationKey == 0) {
                continue;
            }
            reset(conversationByIndex(conversationKey));
        }
        reset(conversationKeysAtom);
    }, []);
    return clearAllConversations;
}
const conversationByKeySelector = conversationByIndex;
function useClearSubmissionState() {
    const clearAllSubmissions = useRecoilCallback(({ reset, set, snapshot }) => async (skipFirst) => {
        const submissionKeys = await snapshot.getPromise(submissionKeysSelector);
        logger.log('submissionKeys', submissionKeys);
        for (const key of submissionKeys) {
            if (skipFirst === true && key == 0) {
                continue;
            }
            logger.log('resetting submission', key);
            reset(submissionByIndex(key));
        }
        set(submissionKeysSelector, []);
    }, []);
    return clearAllSubmissions;
}
const updateConversationSelector = selectorFamily({
    key: 'updateConversationSelector',
    get: () => () => null,
    set: (conversationId) => ({ set, get }, newPartialConversation) => {
        if (newPartialConversation instanceof DefaultValue) {
            return;
        }
        const keys = get(conversationKeysAtom);
        keys.forEach((key) => {
            set(conversationByIndex(key), (prevConversation) => {
                if (prevConversation && prevConversation.conversationId === conversationId) {
                    return {
                        ...prevConversation,
                        ...newPartialConversation,
                    };
                }
                return prevConversation;
            });
        });
    },
});
export default {
    conversationKeysAtom,
    conversationByIndex,
    filesByIndex,
    presetByIndex,
    submissionByIndex,
    textByIndex,
    showStopButtonByIndex,
    abortScrollFamily,
    isSubmittingFamily,
    optionSettingsFamily,
    showPopoverFamily,
    messagesSiblingIdxFamily,
    anySubmittingSelector,
    allConversationsSelector,
    conversationIdByIndex,
    conversationEndpointByIndex,
    effectiveEndpointByIndex,
    conversationModelByIndex,
    conversationSpecByIndex,
    conversationAgentIdByIndex,
    conversationAssistantIdByIndex,
    conversationByKeySelector,
    useClearConvoState,
    useCreateConversationAtom,
    useSetConversationAtom,
    showMentionPopoverFamily,
    globalAudioURLFamily,
    activeRunFamily,
    audioRunFamily,
    globalAudioPlayingFamily,
    globalAudioFetchingFamily,
    showPlusPopoverFamily,
    activePromptByIndex,
    useClearSubmissionState,
    showPromptsPopoverFamily,
    showSkillsPopoverFamily,
    pendingManualSkillsByConvoId,
    updateConversationSelector,
};
