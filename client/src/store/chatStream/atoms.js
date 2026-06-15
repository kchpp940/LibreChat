import { atomFamily, selectorFamily, useRecoilState, useRecoilValue, useSetRecoilState, useRecoilCallback, } from 'recoil';
import { chatStreamReducer, createInitialState, deriveSelectors } from './reducer';
export const chatStreamFamily = atomFamily({
    key: 'chatStreamFamily',
    default: (runIndex) => createInitialState(runIndex),
});
export const chatStreamSelectorsFamily = selectorFamily({
    key: 'chatStreamSelectorsFamily',
    get: (runIndex) => ({ get }) => {
        const state = get(chatStreamFamily(runIndex));
        return deriveSelectors(state);
    },
});
export const chatStreamStatusFamily = selectorFamily({
    key: 'chatStreamStatusFamily',
    get: (runIndex) => ({ get }) => get(chatStreamFamily(runIndex)).status,
});
export const chatStreamIsRunningFamily = selectorFamily({
    key: 'chatStreamIsRunningFamily',
    get: (runIndex) => ({ get }) => {
        const selectors = get(chatStreamSelectorsFamily(runIndex));
        return selectors.isRunning;
    },
});
export const chatStreamShowStopFamily = selectorFamily({
    key: 'chatStreamShowStopFamily',
    get: (runIndex) => ({ get }) => {
        const selectors = get(chatStreamSelectorsFamily(runIndex));
        return selectors.shouldShowStop;
    },
});
export const chatStreamAbortScrollFamily = selectorFamily({
    key: 'chatStreamAbortScrollFamily',
    get: (runIndex) => ({ get }) => get(chatStreamFamily(runIndex)).abortScroll,
});
export const chatStreamActiveRunIdFamily = selectorFamily({
    key: 'chatStreamActiveRunIdFamily',
    get: (runIndex) => ({ get }) => get(chatStreamFamily(runIndex)).activeRunId,
});
export const chatStreamErrorFamily = selectorFamily({
    key: 'chatStreamErrorFamily',
    get: (runIndex) => ({ get }) => get(chatStreamFamily(runIndex)).error,
});
export const chatStreamSubmissionFamily = selectorFamily({
    key: 'chatStreamSubmissionFamily',
    get: (runIndex) => ({ get }) => get(chatStreamFamily(runIndex)).submission,
});
export const chatStreamStreamIdFamily = selectorFamily({
    key: 'chatStreamStreamIdFamily',
    get: (runIndex) => ({ get }) => get(chatStreamFamily(runIndex)).streamId,
});
export function useChatStreamState(runIndex) {
    return useRecoilState(chatStreamFamily(runIndex));
}
export function useChatStreamValue(runIndex) {
    return useRecoilValue(chatStreamFamily(runIndex));
}
export function useSetChatStreamState(runIndex) {
    return useSetRecoilState(chatStreamFamily(runIndex));
}
export function useChatStreamDispatch(runIndex) {
    return useRecoilCallback(({ set }) => (action) => {
        set(chatStreamFamily(runIndex), (prevState) => chatStreamReducer(prevState, action));
    }, [runIndex]);
}
export function useChatStreamSelectors(runIndex) {
    return useRecoilValue(chatStreamSelectorsFamily(runIndex));
}
export function useChatStreamIsSubmitting(runIndex) {
    return useChatStreamIsRunning(runIndex);
}
export function useChatStreamIsRunning(runIndex) {
    return useRecoilValue(chatStreamIsRunningFamily(runIndex));
}
export function useChatStreamShowStop(runIndex) {
    return useRecoilValue(chatStreamShowStopFamily(runIndex));
}
export function useChatStreamAbortScroll(runIndex) {
    return useRecoilValue(chatStreamAbortScrollFamily(runIndex));
}
export function useChatStreamSetAbortScroll(runIndex) {
    const dispatch = useChatStreamDispatch(runIndex);
    return (value) => dispatch({ type: 'SET_ABORT_SCROLL', payload: value });
}
