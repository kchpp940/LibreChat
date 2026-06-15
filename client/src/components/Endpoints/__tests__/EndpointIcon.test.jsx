import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EModelEndpoint } from 'librechat-data-provider';
import EndpointIcon from '../EndpointIcon';
jest.mock('~/components/Endpoints/ConvoIconURL', () => ({
    __esModule: true,
    default: ({ iconURL, modelLabel, agentAvatar, agentName, }) => (<img src={iconURL} alt={modelLabel || 'Icon'} data-testid="convo-url-icon" data-agent-avatar={agentAvatar} data-agent-name={agentName}/>),
}));
jest.mock('~/components/Endpoints/MinimalIcon', () => ({
    __esModule: true,
    default: ({ endpoint, iconURL }) => (<div data-testid="minimal-icon" data-endpoint={endpoint ?? ''} data-icon-url={iconURL ?? ''}/>),
}));
const endpointsConfig = {
    [EModelEndpoint.agents]: { order: 0 },
    [EModelEndpoint.google]: { order: 1 },
};
const agent = {
    id: 'agent_123',
    name: 'Research Agent',
    avatar: {
        filepath: '/images/agents/agent_123/avatar.png',
        source: 'local',
    },
};
describe('EndpointIcon', () => {
    it('uses the agent avatar when the agents endpoint would otherwise render its default icon', () => {
        const conversation = {
            endpoint: EModelEndpoint.agents,
            agent_id: agent.id,
            iconURL: EModelEndpoint.agents,
        };
        render(<EndpointIcon conversation={conversation} endpointsConfig={endpointsConfig} agentsMap={{ [agent.id]: agent }}/>);
        const icon = screen.getByTestId('convo-url-icon');
        expect(icon).toHaveAttribute('src', '/images/agents/agent_123/avatar.png');
        expect(icon).toHaveAttribute('alt', 'Research Agent');
    });
    it('keeps an explicit model spec icon ahead of the agent avatar', () => {
        const conversation = {
            endpoint: EModelEndpoint.agents,
            agent_id: agent.id,
            spec: 'research-spec',
            iconURL: EModelEndpoint.google,
        };
        render(<EndpointIcon conversation={conversation} endpointsConfig={endpointsConfig} agentsMap={{ [agent.id]: agent }}/>);
        expect(screen.queryByTestId('convo-url-icon')).not.toBeInTheDocument();
        expect(screen.getByTestId('minimal-icon')).toHaveAttribute('data-endpoint', EModelEndpoint.google);
    });
});
