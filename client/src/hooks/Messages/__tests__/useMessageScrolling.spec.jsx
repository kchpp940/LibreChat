import React from 'react';
import { RecoilRoot } from 'recoil';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessagesViewContext, } from '~/Providers/MessagesViewContext';
const mockScrollToBottom = jest.fn();
mockScrollToBottom.cancel = jest.fn();
mockScrollToBottom.flush = jest.fn();
const mockHandleSmoothToRef = jest.fn();
let mockScrollCallback;
jest.mock('~/hooks/useScrollToRef', () => ({
    __esModule: true,
    default: ({ callback }) => {
        mockScrollCallback = callback;
        return {
            scrollToRef: mockScrollToBottom,
            handleSmoothToRef: mockHandleSmoothToRef,
        };
    },
}));
jest.mock('../messageLayout', () => ({
    reconcileMessageContentLayout: jest.fn(),
}));
import useMessageScrolling from '../useMessageScrolling';
import { reconcileMessageContentLayout } from '../messageLayout';
const mockReconcileMessageContentLayout = reconcileMessageContentLayout;
class MockResizeObserver {
    static instances = [];
    static reset() {
        MockResizeObserver.instances = [];
    }
    static last() {
        return MockResizeObserver.instances[MockResizeObserver.instances.length - 1];
    }
    callback;
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
    constructor(callback) {
        this.callback = callback;
        MockResizeObserver.instances.push(this);
    }
    trigger() {
        this.callback([], this);
    }
}
class MockIntersectionObserver {
    static instances = [];
    static reset() {
        MockIntersectionObserver.instances = [];
    }
    callback;
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
    takeRecords = jest.fn(() => []);
    constructor(callback) {
        this.callback = callback;
        MockIntersectionObserver.instances.push(this);
    }
}
const originalResizeObserver = global.ResizeObserver;
const originalIntersectionObserver = global.IntersectionObserver;
function setRect(element, rect) {
    element.getBoundingClientRect = jest.fn(() => ({
        x: rect.x ?? 0,
        y: rect.y ?? 0,
        top: rect.top ?? 0,
        left: rect.left ?? 0,
        right: rect.right ?? 0,
        bottom: rect.bottom ?? 0,
        width: rect.width ?? 0,
        height: rect.height ?? 0,
        toJSON: () => ({}),
    }));
}
const conversation = {
    conversationId: 'conversation-1',
    endpoint: 'openAI',
    model: 'gpt-4',
};
const message = {
    messageId: 'message-1',
    conversationId: conversation.conversationId,
    isCreatedByUser: false,
};
function createContextValue(overrides = {}) {
    return {
        conversation,
        conversationId: conversation.conversationId,
        isSubmitting: true,
        abortScroll: false,
        setAbortScroll: jest.fn(),
        ask: jest.fn(),
        regenerate: jest.fn(),
        handleContinue: jest.fn(),
        index: 0,
        latestMessageId: message.messageId,
        latestMessageDepth: 0,
        getMessages: jest.fn(),
        setMessages: jest.fn(),
        ...overrides,
    };
}
function ScrollingHarness({ messagesTree }) {
    const { contentRef, scrollableRef, messagesEndRef, debouncedHandleScroll } = useMessageScrolling(messagesTree);
    return (<div ref={scrollableRef} onScroll={debouncedHandleScroll} data-testid="scrollable">
      <div ref={contentRef} data-testid="content">
        <div ref={messagesEndRef} data-testid="end"/>
      </div>
    </div>);
}
function renderScrolling({ contextOverrides, messagesTree, } = {}) {
    return render(<RecoilRoot>
      <MessagesViewContext.Provider value={createContextValue(contextOverrides)}>
        <ScrollingHarness messagesTree={messagesTree}/>
      </MessagesViewContext.Provider>
    </RecoilRoot>);
}
describe('useMessageScrolling resize reconciliation', () => {
    beforeEach(() => {
        MockResizeObserver.reset();
        MockIntersectionObserver.reset();
        mockScrollToBottom.mockClear();
        mockScrollToBottom.cancel.mockClear();
        mockScrollToBottom.flush.mockClear();
        mockHandleSmoothToRef.mockClear();
        mockReconcileMessageContentLayout.mockClear();
        mockScrollCallback = undefined;
        global.ResizeObserver =
            MockResizeObserver;
        global.IntersectionObserver = MockIntersectionObserver;
    });
    afterEach(() => {
        global.ResizeObserver =
            originalResizeObserver;
        global.IntersectionObserver = originalIntersectionObserver;
    });
    it('scrolls to the bottom when streaming content resizes and auto-scroll is active', () => {
        renderScrolling();
        const observer = MockResizeObserver.last();
        expect(observer?.observe).toHaveBeenCalledWith(screen.getByTestId('content'));
        act(() => {
            observer?.trigger();
        });
        expect(mockScrollToBottom).toHaveBeenCalledTimes(1);
    });
    it('reconciles message layout after an explicit scroll to bottom', () => {
        renderScrolling();
        const scrollable = screen.getByTestId('scrollable');
        act(() => {
            mockScrollCallback?.();
        });
        expect(mockReconcileMessageContentLayout).toHaveBeenCalledWith(scrollable);
    });
    it('does not follow resizes after the user aborts streaming auto-scroll', () => {
        renderScrolling({ contextOverrides: { abortScroll: true } });
        act(() => {
            MockResizeObserver.last()?.trigger();
        });
        expect(mockScrollToBottom).not.toHaveBeenCalled();
    });
    it('does not follow resizes after the user scrolls away from the bottom', () => {
        renderScrolling();
        const scrollable = screen.getByTestId('scrollable');
        Object.defineProperty(scrollable, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(scrollable, 'clientHeight', { value: 200, configurable: true });
        scrollable.scrollTop = 100;
        fireEvent.scroll(scrollable);
        act(() => {
            MockResizeObserver.last()?.trigger();
        });
        expect(mockScrollToBottom).not.toHaveBeenCalled();
    });
    it('does not follow the next resize after user interaction inside message content', () => {
        renderScrolling();
        fireEvent.pointerDown(screen.getByTestId('content'));
        act(() => {
            MockResizeObserver.last()?.trigger();
        });
        expect(mockScrollToBottom).not.toHaveBeenCalled();
    });
    it('clamps the scroll position back to content after a resize shrink', () => {
        renderScrolling({ contextOverrides: { abortScroll: true } });
        const scrollable = screen.getByTestId('scrollable');
        Object.defineProperty(scrollable, 'scrollHeight', { value: 500, configurable: true });
        Object.defineProperty(scrollable, 'clientHeight', { value: 200, configurable: true });
        scrollable.scrollTop = 450;
        act(() => {
            MockResizeObserver.last()?.trigger();
        });
        expect(scrollable.scrollTop).toBe(300);
        expect(mockScrollToBottom).not.toHaveBeenCalled();
    });
    it('does not clamp to rendered content bottom during general resize reconciliation', () => {
        renderScrolling({ contextOverrides: { abortScroll: true } });
        const scrollable = screen.getByTestId('scrollable');
        const content = screen.getByTestId('content');
        Object.defineProperty(scrollable, 'scrollHeight', { value: 1000, configurable: true });
        Object.defineProperty(scrollable, 'clientHeight', { value: 200, configurable: true });
        scrollable.scrollTop = 700;
        setRect(scrollable, { top: 0, bottom: 200, height: 200 });
        setRect(content, { top: -700, bottom: -200, height: 500 });
        act(() => {
            MockResizeObserver.last()?.trigger();
        });
        expect(scrollable.scrollTop).toBe(700);
        expect(mockScrollToBottom).not.toHaveBeenCalled();
    });
});
