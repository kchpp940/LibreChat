jest.mock('recoil', () => ({
    ...jest.requireActual('recoil'),
    useRecoilValue: jest.fn(),
}));
jest.mock('~/store', () => ({
    saveDrafts: { key: 'saveDrafts', default: true },
}));
jest.mock('~/Providers', () => ({
    useChatFormContext: jest.fn(),
}));
jest.mock('~/data-provider', () => ({
    useGetFiles: jest.fn(),
}));
jest.mock('~/utils', () => ({
    ...jest.requireActual('~/utils'),
    getDraft: jest.fn(),
    setDraft: jest.fn(),
    clearDraft: jest.fn(),
    clearAllDrafts: jest.fn(),
}));
import { renderHook, act } from '@testing-library/react';
import { useRecoilValue } from 'recoil';
import { useChatFormContext } from '~/Providers';
import { useGetFiles } from '~/data-provider';
import { getDraft, setDraft } from '~/utils';
import store from '~/store';
import { useAutoSave } from '~/hooks';
const mockSetValue = jest.fn();
const mockGetDraft = getDraft;
const mockSetDraft = setDraft;
const makeTextAreaRef = (value = '') => ({
    current: { value, addEventListener: jest.fn(), removeEventListener: jest.fn() },
});
beforeEach(() => {
    useRecoilValue.mockImplementation((atom) => {
        if (atom === store.saveDrafts)
            return true;
        return undefined;
    });
    useChatFormContext.mockReturnValue({ setValue: mockSetValue });
    useGetFiles.mockReturnValue({ data: [] });
    mockGetDraft.mockReturnValue('');
});
describe('useAutoSave — conversation switching', () => {
    it('clears the textarea when switching to a conversation with no draft', () => {
        const { rerender } = renderHook(({ conversationId }) => useAutoSave({
            conversationId,
            textAreaRef: makeTextAreaRef(),
            files: new Map(),
            setFiles: jest.fn(),
        }), { initialProps: { conversationId: 'convo-1' } });
        act(() => {
            rerender({ conversationId: 'convo-2' });
        });
        expect(mockSetValue).toHaveBeenLastCalledWith('text', '');
    });
    it('restores the saved draft when switching to a conversation with one', () => {
        mockGetDraft.mockImplementation((id) => (id === 'convo-2' ? 'Hello, world!' : ''));
        const { rerender } = renderHook(({ conversationId }) => useAutoSave({
            conversationId,
            textAreaRef: makeTextAreaRef(),
            files: new Map(),
            setFiles: jest.fn(),
        }), { initialProps: { conversationId: 'convo-1' } });
        act(() => {
            rerender({ conversationId: 'convo-2' });
        });
        expect(mockSetValue).toHaveBeenLastCalledWith('text', 'Hello, world!');
    });
    it('saves the current textarea content before switching away', () => {
        const textAreaRef = makeTextAreaRef('draft in progress');
        const { rerender } = renderHook(({ conversationId }) => useAutoSave({ conversationId, textAreaRef, files: new Map(), setFiles: jest.fn() }), { initialProps: { conversationId: 'convo-1' } });
        act(() => {
            rerender({ conversationId: 'convo-2' });
        });
        expect(mockSetDraft).toHaveBeenCalledWith({ id: 'convo-1', value: 'draft in progress' });
    });
});
