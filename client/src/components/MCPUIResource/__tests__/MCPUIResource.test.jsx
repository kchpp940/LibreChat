import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { MCPUIResource } from '../MCPUIResource';
import { useMessageContext, useOptionalMessagesConversation, useOptionalMessagesOperations, } from '~/Providers';
import { useLocalize } from '~/hooks';
import { handleUIAction } from '~/utils';
// Mock dependencies
jest.mock('~/Providers');
jest.mock('~/hooks');
jest.mock('~/utils');
jest.mock('@mcp-ui/client', () => ({
    UIResourceRenderer: ({ resource, onUIAction }) => (<div data-testid="ui-resource-renderer" data-resource-uri={resource?.uri} onClick={() => onUIAction({ action: 'test' })}/>),
}));
const mockUseMessageContext = useMessageContext;
const mockUseMessagesConversation = useOptionalMessagesConversation;
const mockUseMessagesOperations = useOptionalMessagesOperations;
const mockUseLocalize = useLocalize;
const mockHandleUIAction = handleUIAction;
describe('MCPUIResource', () => {
    const mockLocalize = (key, values) => {
        const translations = {
            com_ui_ui_resource_not_found: `UI resource ${values?.[0]} not found`,
            com_ui_ui_resource_error: `Error rendering UI resource: ${values?.[0]}`,
        };
        return translations[key] || key;
    };
    const mockAskFn = jest.fn();
    const renderWithRecoil = (ui) => render(<RecoilRoot>{ui}</RecoilRoot>);
    // Store the current test's messages so getMessages can return them
    let currentTestMessages = [];
    beforeEach(() => {
        jest.clearAllMocks();
        currentTestMessages = [];
        mockUseMessageContext.mockReturnValue({ messageId: 'msg123' });
        mockUseMessagesConversation.mockReturnValue({
            conversation: { conversationId: 'conv123' },
            conversationId: 'conv123',
        });
        mockUseMessagesOperations.mockReturnValue({
            ask: mockAskFn,
            getMessages: () => currentTestMessages,
            regenerate: jest.fn(),
            handleContinue: jest.fn(),
            setMessages: jest.fn(),
        });
        mockUseLocalize.mockReturnValue(mockLocalize);
    });
    describe('resource fetching', () => {
        it('should fetch and render UI resource from message attachments', () => {
            currentTestMessages = [
                {
                    messageId: 'msg123',
                    attachments: [
                        {
                            type: 'ui_resources',
                            ui_resources: [
                                {
                                    resourceId: 'resource-1',
                                    uri: 'ui://test/resource',
                                    mimeType: 'text/html',
                                    text: '<p>Test Resource</p>',
                                },
                            ],
                        },
                    ],
                },
            ];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'resource-1' } }}/>);
            const renderer = screen.getByTestId('ui-resource-renderer');
            expect(renderer).toBeInTheDocument();
            expect(renderer).toHaveAttribute('data-resource-uri', 'ui://test/resource');
        });
        it('should show not found message when resourceId does not exist', () => {
            currentTestMessages = [
                {
                    messageId: 'msg123',
                    attachments: [
                        {
                            type: 'ui_resources',
                            ui_resources: [
                                {
                                    resourceId: 'resource-1',
                                    uri: 'ui://test/resource',
                                    mimeType: 'text/html',
                                    text: '<p>Test Resource</p>',
                                },
                            ],
                        },
                    ],
                },
            ];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'nonexistent-id' } }}/>);
            expect(screen.getByText('UI resource nonexistent-id not found')).toBeInTheDocument();
            expect(screen.queryByTestId('ui-resource-renderer')).not.toBeInTheDocument();
        });
        it('should show not found when no ui_resources attachments', () => {
            currentTestMessages = [
                {
                    messageId: 'msg123',
                    attachments: [
                        {
                            type: 'web_search',
                            web_search: { results: [] },
                        },
                    ],
                },
            ];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'resource-1' } }}/>);
            expect(screen.getByText('UI resource resource-1 not found')).toBeInTheDocument();
        });
        it('should resolve resources by resourceId across conversation messages', () => {
            mockUseMessageContext.mockReturnValue({ messageId: 'msg-current' });
            currentTestMessages = [
                {
                    messageId: 'msg-previous',
                    attachments: [
                        {
                            type: 'ui_resources',
                            ui_resources: [
                                {
                                    resourceId: 'abc123',
                                    uri: 'ui://test/resource-id',
                                    mimeType: 'text/html',
                                    text: '<p>Resource via ID</p>',
                                },
                            ],
                        },
                    ],
                },
                {
                    messageId: 'msg-current',
                    attachments: [],
                },
            ];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'abc123' } }}/>);
            const renderer = screen.getByTestId('ui-resource-renderer');
            expect(renderer).toBeInTheDocument();
            expect(renderer).toHaveAttribute('data-resource-uri', 'ui://test/resource-id');
        });
    });
    describe('UI action handling', () => {
        it('should handle UI actions with handleUIAction', async () => {
            currentTestMessages = [
                {
                    messageId: 'msg123',
                    attachments: [
                        {
                            type: 'ui_resources',
                            ui_resources: [
                                {
                                    resourceId: 'resource-1',
                                    uri: 'ui://test/resource',
                                    mimeType: 'text/html',
                                    text: '<p>Interactive Resource</p>',
                                },
                            ],
                        },
                    ],
                },
            ];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'resource-1' } }}/>);
            const renderer = screen.getByTestId('ui-resource-renderer');
            renderer.click();
            expect(mockHandleUIAction).toHaveBeenCalledWith({ action: 'test' }, mockAskFn);
        });
    });
    describe('edge cases', () => {
        it('should handle empty messages array', () => {
            currentTestMessages = [];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'resource-1' } }}/>);
            expect(screen.getByText('UI resource resource-1 not found')).toBeInTheDocument();
        });
        it('should handle null messages data', () => {
            currentTestMessages = [];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'resource-1' } }}/>);
            expect(screen.getByText('UI resource resource-1 not found')).toBeInTheDocument();
        });
        it('should handle missing conversation', () => {
            currentTestMessages = [];
            mockUseMessagesConversation.mockReturnValue({
                conversation: null,
                conversationId: null,
            });
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'resource-1' } }}/>);
            expect(screen.getByText('UI resource resource-1 not found')).toBeInTheDocument();
        });
        it('should handle multiple attachments of ui_resources type', () => {
            currentTestMessages = [
                {
                    messageId: 'msg123',
                    attachments: [
                        {
                            type: 'ui_resources',
                            ui_resources: [
                                {
                                    resourceId: 'resource-1',
                                    uri: 'ui://test/resource1',
                                    mimeType: 'text/html',
                                    text: '<p>Resource 1</p>',
                                },
                            ],
                        },
                        {
                            type: 'ui_resources',
                            ui_resources: [
                                {
                                    resourceId: 'resource-2',
                                    uri: 'ui://test/resource2',
                                    mimeType: 'text/html',
                                    text: '<p>Resource 2</p>',
                                },
                                {
                                    resourceId: 'resource-3',
                                    uri: 'ui://test/resource3',
                                    mimeType: 'text/html',
                                    text: '<p>Resource 3</p>',
                                },
                            ],
                        },
                    ],
                },
            ];
            renderWithRecoil(<MCPUIResource node={{ properties: { resourceId: 'resource-2' } }}/>);
            const renderer = screen.getByTestId('ui-resource-renderer');
            expect(renderer).toBeInTheDocument();
            expect(renderer).toHaveAttribute('data-resource-uri', 'ui://test/resource2');
        });
    });
});
