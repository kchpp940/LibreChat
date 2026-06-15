import React, { createContext, useContext, useState, useMemo } from 'react';
import { EModelEndpoint } from 'librechat-data-provider';
import { useAvailableToolsQuery, useGetActionsQuery, useGetStartupConfig, useMCPToolsQuery, } from '~/data-provider';
import { useLocalize, useGetAgentsConfig, useMCPConnectionStatus, useMCPServerManager, } from '~/hooks';
import { Panel, isEphemeralAgent } from '~/common';
const AgentPanelContext = createContext(undefined);
export function useAgentPanelContext() {
    const context = useContext(AgentPanelContext);
    if (context === undefined) {
        throw new Error('useAgentPanelContext must be used within an AgentPanelProvider');
    }
    return context;
}
/** Houses relevant state for the Agent Form Panels (formerly 'commonProps') */
export function AgentPanelProvider({ children }) {
    const localize = useLocalize();
    const [mcp, setMcp] = useState(undefined);
    const [mcps, setMcps] = useState(undefined);
    const [action, setAction] = useState(undefined);
    const [activePanel, setActivePanel] = useState(Panel.builder);
    const [agent_id, setCurrentAgentId] = useState(undefined);
    const { availableMCPServers, isLoading, availableMCPServersMap } = useMCPServerManager();
    const { data: startupConfig } = useGetStartupConfig();
    const { data: actions } = useGetActionsQuery(EModelEndpoint.agents, {
        enabled: !isEphemeralAgent(agent_id),
    });
    const { data: regularTools } = useAvailableToolsQuery(EModelEndpoint.agents);
    const { data: mcpData } = useMCPToolsQuery({
        enabled: !isEphemeralAgent(agent_id) &&
            !isLoading &&
            availableMCPServers != null &&
            availableMCPServers.length > 0,
    });
    const { agentsConfig, endpointsConfig } = useGetAgentsConfig();
    const mcpServerNames = useMemo(() => availableMCPServers.map((s) => s.serverName), [availableMCPServers]);
    const { connectionStatus } = useMCPConnectionStatus({
        enabled: !isEphemeralAgent(agent_id) && mcpServerNames.length > 0,
    });
    //TODO to refactor when tools come from tool box
    const mcpServersMap = useMemo(() => {
        const configuredServers = new Set(mcpServerNames);
        const serversMap = new Map();
        if (mcpData?.servers) {
            for (const [serverName, serverData] of Object.entries(mcpData.servers)) {
                // Get title and description from config with fallbacks
                const serverConfig = availableMCPServersMap?.[serverName];
                const displayName = serverConfig?.title || serverName;
                const displayDescription = serverConfig?.description || `${localize('com_ui_tool_collection_prefix')} ${serverName}`;
                const metadata = {
                    name: displayName,
                    pluginKey: serverName,
                    description: displayDescription,
                    icon: serverData.icon || '',
                    authConfig: serverData.authConfig,
                    authenticated: serverData.authenticated,
                };
                const tools = serverData.tools.map((tool) => ({
                    tool_id: tool.pluginKey,
                    metadata: {
                        ...tool,
                        icon: serverData.icon,
                        authConfig: serverData.authConfig,
                        authenticated: serverData.authenticated,
                    },
                }));
                serversMap.set(serverName, {
                    serverName,
                    tools,
                    isConfigured: configuredServers.has(serverName),
                    isConnected: connectionStatus?.[serverName]?.connectionState === 'connected',
                    metadata,
                    consumeOnly: serverConfig?.consumeOnly,
                });
            }
        }
        // Add configured servers that don't have tools yet
        for (const mcpServerName of mcpServerNames) {
            if (serversMap.has(mcpServerName)) {
                continue;
            }
            // Get title and description from config with fallbacks
            const serverConfig = availableMCPServersMap?.[mcpServerName];
            const displayName = serverConfig?.title || mcpServerName;
            const displayDescription = serverConfig?.description ||
                `${localize('com_ui_tool_collection_prefix')} ${mcpServerName}`;
            const metadata = {
                icon: serverConfig?.iconPath || '',
                name: displayName,
                pluginKey: mcpServerName,
                description: displayDescription,
            };
            serversMap.set(mcpServerName, {
                tools: [],
                metadata,
                isConfigured: true,
                serverName: mcpServerName,
                isConnected: connectionStatus?.[mcpServerName]?.connectionState === 'connected',
                consumeOnly: serverConfig?.consumeOnly,
            });
        }
        return serversMap;
    }, [mcpData, localize, mcpServerNames, connectionStatus, availableMCPServersMap]);
    const value = {
        mcp,
        mcps,
        action,
        setMcp,
        actions,
        setMcps,
        agent_id,
        setAction,
        activePanel,
        regularTools,
        agentsConfig,
        startupConfig,
        mcpServersMap,
        setActivePanel,
        endpointsConfig,
        setCurrentAgentId,
        availableMCPServers,
        availableMCPServersMap,
    };
    return <AgentPanelContext.Provider value={value}>{children}</AgentPanelContext.Provider>;
}
