import {
  atomFamily,
  selectorFamily,
  useRecoilState,
  useRecoilValue,
  useSetRecoilState,
  useRecoilCallback,
} from 'recoil';
import type { ChatStreamState, ChatStreamAction, ChatStreamSelectors } from './types';
import { chatStreamReducer, createInitialState, deriveSelectors } from './reducer';

export const chatStreamFamily = atomFamily<ChatStreamState, string | number>({
  key: 'chatStreamFamily',
  default: (runIndex) => createInitialState(runIndex),
});

export const chatStreamSelectorsFamily = selectorFamily<ChatStreamSelectors, string | number>({
  key: 'chatStreamSelectorsFamily',
  get:
    (runIndex) =>
    ({ get }) => {
      const state = get(chatStreamFamily(runIndex));
      return deriveSelectors(state);
    },
});

export const chatStreamStatusFamily = selectorFamily<ChatStreamState['status'], string | number>({
  key: 'chatStreamStatusFamily',
  get:
    (runIndex) =>
    ({ get }) =>
      get(chatStreamFamily(runIndex)).status,
});

export const chatStreamIsRunningFamily = selectorFamily<boolean, string | number>({
  key: 'chatStreamIsRunningFamily',
  get:
    (runIndex) =>
    ({ get }) => {
      const selectors = get(chatStreamSelectorsFamily(runIndex));
      return selectors.isRunning;
    },
});

export const chatStreamShowStopFamily = selectorFamily<boolean, string | number>({
  key: 'chatStreamShowStopFamily',
  get:
    (runIndex) =>
    ({ get }) => {
      const selectors = get(chatStreamSelectorsFamily(runIndex));
      return selectors.shouldShowStop;
    },
});

export const chatStreamAbortScrollFamily = selectorFamily<boolean, string | number>({
  key: 'chatStreamAbortScrollFamily',
  get:
    (runIndex) =>
    ({ get }) =>
      get(chatStreamFamily(runIndex)).abortScroll,
});

export const chatStreamActiveRunIdFamily = selectorFamily<string | null, string | number>({
  key: 'chatStreamActiveRunIdFamily',
  get:
    (runIndex) =>
    ({ get }) =>
      get(chatStreamFamily(runIndex)).activeRunId,
});

export const chatStreamErrorFamily = selectorFamily<ChatStreamState['error'], string | number>({
  key: 'chatStreamErrorFamily',
  get:
    (runIndex) =>
    ({ get }) =>
      get(chatStreamFamily(runIndex)).error,
});

export const chatStreamSubmissionFamily = selectorFamily<ChatStreamState['submission'], string | number>({
  key: 'chatStreamSubmissionFamily',
  get:
    (runIndex) =>
    ({ get }) =>
      get(chatStreamFamily(runIndex)).submission,
});

export const chatStreamStreamIdFamily = selectorFamily<string | null, string | number>({
  key: 'chatStreamStreamIdFamily',
  get:
    (runIndex) =>
    ({ get }) =>
      get(chatStreamFamily(runIndex)).streamId,
});

export function useChatStreamState(runIndex: string | number) {
  return useRecoilState(chatStreamFamily(runIndex));
}

export function useChatStreamValue(runIndex: string | number) {
  return useRecoilValue(chatStreamFamily(runIndex));
}

export function useSetChatStreamState(runIndex: string | number) {
  return useSetRecoilState(chatStreamFamily(runIndex));
}

export function useChatStreamDispatch(runIndex: string | number) {
  return useRecoilCallback(
    ({ set }) =>
      (action: ChatStreamAction) => {
        set(chatStreamFamily(runIndex), (prevState) => chatStreamReducer(prevState, action));
      },
    [runIndex],
  );
}

export function useChatStreamSelectors(runIndex: string | number) {
  return useRecoilValue(chatStreamSelectorsFamily(runIndex));
}

export function useChatStreamIsSubmitting(runIndex: string | number) {
  return useChatStreamIsRunning(runIndex);
}

export function useChatStreamIsRunning(runIndex: string | number) {
  return useRecoilValue(chatStreamIsRunningFamily(runIndex));
}

export function useChatStreamShowStop(runIndex: string | number) {
  return useRecoilValue(chatStreamShowStopFamily(runIndex));
}

export function useChatStreamAbortScroll(runIndex: string | number) {
  return useRecoilValue(chatStreamAbortScrollFamily(runIndex));
}

export function useChatStreamSetAbortScroll(runIndex: string | number) {
  const dispatch = useChatStreamDispatch(runIndex);
  return (value: boolean) => dispatch({ type: 'SET_ABORT_SCROLL', payload: value });
}
