import React from 'react';
import { render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { EModelEndpoint, mergeFileConfig } from 'librechat-data-provider';
import FileContext from '../FileContext';
const mockEndpointsConfig = {
    [EModelEndpoint.agents]: { userProvide: false, order: 1 },
    Moonshot: { type: EModelEndpoint.custom, userProvide: false, order: 9999 },
};
let mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });
jest.mock('~/data-provider', () => ({
    useGetEndpointsQuery: () => ({ data: mockEndpointsConfig }),
    useGetFileConfig: ({ select }) => ({
        data: select != null ? select(mockFileConfig) : mockFileConfig,
    }),
    useGetStartupConfig: () => ({ data: { sharePointFilePickerEnabled: false } }),
}));
jest.mock('~/hooks', () => ({
    useAgentFileConfig: jest.requireActual('~/hooks/Agents/useAgentFileConfig').default,
    useLocalize: () => (key) => key,
    useLazyEffect: () => { },
}));
const mockUseFileHandlingNoChatContext = jest.fn().mockReturnValue({
    handleFileChange: jest.fn(),
});
jest.mock('~/hooks/Files/useFileHandling', () => ({
    useFileHandlingNoChatContext: (...args) => mockUseFileHandlingNoChatContext(...args),
}));
jest.mock('~/hooks/Files/useSharePointFileHandling', () => ({
    useSharePointFileHandlingNoChatContext: () => ({
        handleSharePointFiles: jest.fn(),
        isProcessing: false,
        downloadProgress: 0,
    }),
}));
jest.mock('~/components/SharePoint', () => ({
    SharePointPickerDialog: () => null,
}));
jest.mock('~/components/Chat/Input/Files/FileRow', () => () => null);
jest.mock('@ariakit/react', () => ({
    MenuButton: ({ children, ...props }) => (<button {...props}>{children}</button>),
}));
jest.mock('@librechat/client', () => ({
    HoverCard: ({ children }) => <div>{children}</div>,
    DropdownPopup: () => null,
    AttachmentIcon: () => <span />,
    CircleHelpIcon: () => <span />,
    SharePointIcon: () => <span />,
    HoverCardPortal: ({ children }) => <div>{children}</div>,
    HoverCardContent: ({ children }) => <div>{children}</div>,
    HoverCardTrigger: ({ children }) => <div>{children}</div>,
}));
function Wrapper({ provider, children }) {
    const methods = useForm({
        defaultValues: { provider: provider },
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
}
describe('FileContext', () => {
    it('renders upload UI when file uploads are not disabled', () => {
        mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });
        render(<Wrapper provider="Moonshot">
        <FileContext agent_id="agent-1"/>
      </Wrapper>);
        expect(screen.getByText('com_agents_file_context_label')).toBeInTheDocument();
    });
    it('returns null when file config is disabled', () => {
        mockFileConfig = mergeFileConfig({
            endpoints: { Moonshot: { disabled: true }, default: { fileLimit: 10 } },
        });
        const { container } = render(<Wrapper provider="Moonshot">
        <FileContext agent_id="agent-1"/>
      </Wrapper>);
        expect(container.innerHTML).toBe('');
    });
    it('returns null when agents endpoint config is disabled and provider has no specific config', () => {
        mockFileConfig = mergeFileConfig({
            endpoints: { [EModelEndpoint.agents]: { disabled: true }, default: { fileLimit: 10 } },
        });
        const { container } = render(<Wrapper>
        <FileContext agent_id="agent-1"/>
      </Wrapper>);
        expect(container.innerHTML).toBe('');
    });
    it('passes provider as endpointOverride and resolved type as endpointTypeOverride', () => {
        mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });
        mockUseFileHandlingNoChatContext.mockClear();
        render(<Wrapper provider="Moonshot">
        <FileContext agent_id="agent-1"/>
      </Wrapper>);
        const params = mockUseFileHandlingNoChatContext.mock.calls[0][0];
        expect(params.endpointOverride).toBe('Moonshot');
        expect(params.endpointTypeOverride).toBe(EModelEndpoint.custom);
    });
    it('falls back to agents for endpointOverride when no provider', () => {
        mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });
        mockUseFileHandlingNoChatContext.mockClear();
        render(<Wrapper>
        <FileContext agent_id="agent-1"/>
      </Wrapper>);
        const params = mockUseFileHandlingNoChatContext.mock.calls[0][0];
        expect(params.endpointOverride).toBe(EModelEndpoint.agents);
        expect(params.endpointTypeOverride).toBe(EModelEndpoint.agents);
    });
    it('renders when provider has no specific config and agents config is enabled', () => {
        mockFileConfig = mergeFileConfig({
            endpoints: {
                [EModelEndpoint.agents]: { fileLimit: 20 },
                default: { fileLimit: 10 },
            },
        });
        render(<Wrapper provider="Moonshot">
        <FileContext agent_id="agent-1"/>
      </Wrapper>);
        expect(screen.getByText('com_agents_file_context_label')).toBeInTheDocument();
    });
});
