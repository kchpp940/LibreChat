import { renderHook } from '@testing-library/react';
import { useChatContext } from '~/Providers';
import useMemoizedChatContext from '../useMemoizedChatContext';
jest.mock('~/Providers', () => ({
    useChatContext: jest.fn(),
}));
const mockUseChatContext = useChatContext;
const conversation = {
    conversationId: 'convo-id',
    endpoint: 'openAI',
    model: 'gpt-4',
};
const message = (overrides = {}) => ({
    messageId: 'assistant-response_',
    parentMessageId: 'user-message',
    conversationId: 'convo-id',
    sender: 'Assistant',
    text: '',
    isCreatedByUser: false,
    children: [],
    ...overrides,
});
function mockChatContext(latestMessageId) {
    mockUseChatContext.mockReturnValue({
        ask: jest.fn(),
        index: 0,
        regenerate: jest.fn(),
        conversation,
        latestMessageId,
        latestMessageDepth: -1,
        handleContinue: jest.fn(),
        isSubmitting: true,
    });
}
describe('useMemoizedChatContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('treats the latest message as submitting while streaming', () => {
        mockChatContext('assistant-response_');
        const { result } = renderHook(() => useMemoizedChatContext(message(), true));
        expect(result.current.effectiveIsSubmitting).toBe(true);
    });
    it('requires latestMessageId alignment before marking a row as submitting', () => {
        mockChatContext(undefined);
        const { result } = renderHook(() => useMemoizedChatContext(message(), true));
        expect(result.current.effectiveIsSubmitting).toBe(false);
        expect(result.current.chatContext.isSubmitting).toBe(true);
    });
});
