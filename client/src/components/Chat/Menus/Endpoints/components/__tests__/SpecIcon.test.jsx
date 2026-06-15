import { render, screen } from '@testing-library/react';
import { EModelEndpoint } from 'librechat-data-provider';
import SpecIcon from '../SpecIcon';
jest.mock('~/hooks/Endpoint/Icons', () => {
    const React = jest.requireActual('react');
    const createIcon = (iconKey) => ({ endpoint, iconURL }) => React.createElement('span', {
        'data-testid': 'endpoint-icon',
        'data-icon-key': iconKey,
        'data-endpoint': endpoint ?? '',
        'data-icon-url': iconURL ?? '',
    });
    return {
        icons: {
            google: createIcon('google'),
            openAI: createIcon('openAI'),
            unknown: createIcon('unknown'),
        },
    };
});
jest.mock('~/components/Endpoints/URLIcon', () => {
    const React = jest.requireActual('react');
    return {
        URLIcon: ({ iconURL, endpoint }) => React.createElement('span', {
            'data-testid': 'url-icon',
            'data-icon-url': iconURL,
            'data-endpoint': endpoint ?? '',
        }),
    };
});
describe('SpecIcon', () => {
    const endpointsConfig = {};
    it('renders the explicit spec icon when runtime spec data is missing preset', () => {
        const currentSpec = {
            name: 'gemini-test',
            label: 'Gemini Test',
            iconURL: EModelEndpoint.google,
        };
        render(<SpecIcon currentSpec={currentSpec} endpointsConfig={endpointsConfig}/>);
        expect(screen.getByTestId('endpoint-icon')).toHaveAttribute('data-icon-key', EModelEndpoint.google);
        expect(screen.getByTestId('endpoint-icon')).toHaveAttribute('data-endpoint', '');
    });
    it('renders same-origin absolute spec icon URLs as images', () => {
        const currentSpec = {
            name: 'clickhouse-test',
            label: 'ClickHouse Test',
            iconURL: '/assets/clickhouse-logo.svg',
            preset: {
                endpoint: EModelEndpoint.anthropic,
            },
        };
        render(<SpecIcon currentSpec={currentSpec} endpointsConfig={endpointsConfig}/>);
        expect(screen.getByTestId('url-icon')).toHaveAttribute('data-icon-url', '/assets/clickhouse-logo.svg');
        expect(screen.getByTestId('url-icon')).toHaveAttribute('data-endpoint', EModelEndpoint.anthropic);
    });
    it('falls back to the unknown icon when runtime spec data has no icon or preset', () => {
        const currentSpec = {
            name: 'gemini-test',
            label: 'Gemini Test',
        };
        render(<SpecIcon currentSpec={currentSpec} endpointsConfig={endpointsConfig}/>);
        expect(screen.getByTestId('endpoint-icon')).toHaveAttribute('data-icon-key', 'unknown');
    });
});
