import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import TrustSection from '../TrustSection';
let mockStartupConfig;
jest.mock('~/data-provider', () => ({
    useGetStartupConfig: () => ({ data: mockStartupConfig }),
}));
jest.mock('~/hooks', () => ({
    useLocalize: () => (key) => {
        const translations = {
            com_ui_trust_app: 'I trust this app',
            com_agents_mcp_trust_subtext: 'Only continue if you trust this MCP server.',
            com_ui_field_required: 'This field is required',
        };
        return translations[key] ?? key;
    },
    useLocalizedConfig: () => (value, fallback) => {
        if (value === undefined) {
            return fallback;
        }
        if (typeof value === 'string') {
            return value;
        }
        return value.en ?? Object.values(value)[0] ?? fallback;
    },
}));
jest.mock('@librechat/client', () => {
    const React = jest.requireActual('react');
    return {
        Checkbox: ({ checked, onCheckedChange, ...props }) => React.createElement('input', {
            type: 'checkbox',
            checked,
            onChange: (event) => onCheckedChange(event.target.checked),
            ...props,
        }),
        Label: ({ children, ...props }) => React.createElement('label', props, children),
    };
}, { virtual: true });
function createDefaultValues() {
    return {
        title: '',
        description: '',
        icon: '',
        url: '',
        type: 'streamable-http',
        auth: {
            auth_type: 'none',
        },
        trust: false,
    };
}
function renderTrustSection() {
    function Wrapper() {
        const methods = useForm({
            defaultValues: createDefaultValues(),
        });
        return (<FormProvider {...methods}>
        <TrustSection />
      </FormProvider>);
    }
    return render(<Wrapper />);
}
describe('TrustSection', () => {
    beforeEach(() => {
        mockStartupConfig = undefined;
    });
    it('sanitizes script-capable trust checkbox label and sub-label HTML', () => {
        mockStartupConfig = {
            interface: {
                mcpServers: {
                    trustCheckbox: {
                        label: '<img src=x onerror="window.__trustXss = true">Trust <script>alert(1)</script><strong>OK</strong>',
                        subLabel: '<a href="javascript:alert(1)" onclick="window.__trustXss = true"><strong>Learn</strong></a><svg onload="alert(1)"></svg>',
                    },
                },
            },
        };
        const { container } = renderTrustSection();
        const label = container.querySelector('#trust-label');
        const description = container.querySelector('#trust-description');
        const link = screen.getByText('Learn').closest('a');
        expect(label).not.toBeNull();
        expect(description).not.toBeNull();
        expect(label?.innerHTML).not.toMatch(/onerror/i);
        expect(description?.innerHTML).not.toMatch(/onclick/i);
        expect(container.querySelector('img')).not.toBeInTheDocument();
        expect(container.querySelector('script')).not.toBeInTheDocument();
        expect(container.querySelector('svg')).not.toBeInTheDocument();
        expect(link).not.toBeNull();
        expect(link).not.toHaveAttribute('href');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
    it('preserves documented formatting while normalizing links', () => {
        mockStartupConfig = {
            interface: {
                mcpServers: {
                    trustCheckbox: {
                        label: { en: 'I <em>understand</em>' },
                        subLabel: 'Read <a href="https://example.com/docs" target="_self"><strong>Learn more.</strong></a><br><code>safe</code>',
                    },
                },
            },
        };
        const { container } = renderTrustSection();
        const emphasis = screen.getByText('understand');
        const strong = screen.getByText('Learn more.');
        const code = screen.getByText('safe');
        const link = strong.closest('a');
        expect(emphasis.tagName).toBe('EM');
        expect(strong.tagName).toBe('STRONG');
        expect(code.tagName).toBe('CODE');
        expect(container.querySelector('#trust-description br')).toBeInTheDocument();
        expect(link).not.toBeNull();
        expect(link).toHaveAttribute('href', 'https://example.com/docs');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
