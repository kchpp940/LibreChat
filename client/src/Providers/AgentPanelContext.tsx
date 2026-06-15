import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import type { MCP, Action, TPlugin, ToolAvailability } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { AgentPanelContextType, MCPServerInfo } from '~/common';
import {
  useAvailableToolsQuery,
  useGetActionsQuery,
  useGetStartupConfig,
  useMCPToolsQuery,
} from '~/data-provider';
import { useResolveToolAvailabilityMutation } from '~/data-provider/Agents/mutations';
import {
  useLocalize,
  useGetAgentsConfig,
  useMCPConnectionStatus,
  useMCPServerManager,
} from '~/hooks';
import { Panel, isEphemeralAgent } from '~/common';

const AgentPanelContext = createContext<AgentPanelContextType | undefined>(undefined);

export function useAgentPanelContext() {
  const context = useContext(AgentPanelContext);
  if (context === undefined) {
    throw new Error('useAgentPanelContext must be used within an AgentPanelProvider');
  }
  return context;
}

const collectToolKeys = (
  mcpData: t.MCPServersResponse | undefined,
  regularTools: TPlugin[] | undefined,
): string[] => {
  const keys = new Set<string>();
  if (mcpData?.servers) {
    for (const [serverName, serverData] of Object.entries(mcpData.servers)) {
      keys.add(`${Constants.mcp_server}${Constants.mcp_delimiter}${serverName}`);
      for (const tool of serverData.tools) {
        keys.add(tool.pluginKey);
      }
    }
  }
  if (regularTools) {
    for (const tool of regularTools) {
      if (tool.pluginKey) {
        keys.add(tool.pluginKey);
      }
    }
  }
  return Array.from(keys);
};

/** Houses relevant state for the Agent Form Panels (formerly 'commonProps') */
export function AgentPanelProvider({ children }: { children: React.ReactNode }) {
  const localize = useLocalize();
  const [mcp, setMcp] = useState<MCP | undefined>(undefined);
  const [mcps, setMcps] = useState<MCP[] | undefined>(undefined);
  const [action, setAction] = useState<Action | undefined>(undefined);
  const [activePanel, setActivePanel] = useState<Panel>(Panel.builder);
  const [agent_id, setCurrentAgentId] = useState<string | undefined>(undefined);
  const [toolAvailabilityMap, setToolAvailabilityMap] = useState<Record<string, ToolAvailability>>(
    {},
  );
  const { availableMCPServers, isLoading, availableMCPServersMap } = useMCPServerManager();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: actions } = useGetActionsQuery(EModelEndpoint.agents, {
    enabled: !isEphemeralAgent(agent_id),
  });

  const { data: regularTools } = useAvailableToolsQuery(EModelEndpoint.agents);

  const { data: mcpData } = useMCPToolsQuery({
    enabled:
      !isEphemeralAgent(agent_id) &&
      !isLoading &&
      availableMCPServers != null &&
      availableMCPServers.length > 0,
  });

  const { agentsConfig, endpointsConfig } = useGetAgentsConfig();
  const mcpServerNames = useMemo(
    () => availableMCPServers.map((s) => s.serverName),
    [availableMCPServers],
  );

  const { connectionStatus } = useMCPConnectionStatus({
    enabled: !isEphemeralAgent(agent_id) && mcpServerNames.length > 0,
  });

  const resolveToolAvailability = useResolveToolAvailabilityMutation();

  const fetchToolAvailability = useCallback(() => {
    if (!agent_id || isEphemeralAgent(agent_id)) {
      setToolAvailabilityMap({});
      return;
    }
    const toolKeys = collectToolKeys(mcpData, regularTools);
    if (toolKeys.length === 0) {
      setToolAvailabilityMap({});
      return;
    }
    resolveToolAvailability.mutate(
      { tools: toolKeys, agent_id },
      {
        onSuccess: (data) => {
          setToolAvailabilityMap(data.tools);
        },
        onError: () => {
          setToolAvailabilityMap({});
        },
      },
    );
  }, [agent_id, mcpData, regularTools, resolveToolAvailability]);

  useEffect(() => {
    fetchToolAvailability();
  }, [fetchToolAvailability]);

  const mcpServersMap = useMemo(() => {
    const configuredServers = new Set(mcpServerNames);
    const serversMap = new Map<string, MCPServerInfo>();

    if (mcpData?.servers) {
      for (const [serverName, serverData] of Object.entries(mcpData.servers)) {
        const serverConfig = availableMCPServersMap?.[serverName];
        const displayName = serverConfig?.title || serverName;
        const displayDescription =
          serverConfig?.description || `${localize('com_ui_tool_collection_prefix')} ${serverName}`;

        const metadata = {
          name: displayName,
          pluginKey: serverName,
          description: displayDescription,
          icon: serverData.icon || '',
          authConfig: serverData.authConfig,
          authenticated: serverData.authenticated,
        } as TPlugin;

        const tools = serverData.tools.map((tool) => ({
          tool_id: tool.pluginKey,
          metadata: {
            ...tool,
            icon: serverData.icon,
            authConfig: serverData.authConfig,
            authenticated: serverData.authenticated,
          } as TPlugin,
        }));

        const serverKey = `${Constants.mcp_server}${Constants.mcp_delimiter}${serverName}`;
        const availability = toolAvailabilityMap[serverKey] || toolAvailabilityMap[serverName];

        serversMap.set(serverName, {
          serverName,
          tools,
          isConfigured: configuredServers.has(serverName),
          isConnected: connectionStatus?.[serverName]?.connectionState === 'connected',
          metadata,
          consumeOnly: serverConfig?.consumeOnly,
          availability,
        });
      }
    }

    for (const mcpServerName of mcpServerNames) {
      if (serversMap.has(mcpServerName)) {
        continue;
      }
      const serverConfig = availableMCPServersMap?.[mcpServerName];
      const displayName = serverConfig?.title || mcpServerName;
      const displayDescription =
        serverConfig?.description ||
        `${localize('com_ui_tool_collection_prefix')} ${mcpServerName}`;

      const metadata = {
        icon: serverConfig?.iconPath || '',
        name: displayName,
        pluginKey: mcpServerName,
        description: displayDescription,
      } as TPlugin;

      const serverKey = `${Constants.mcp_server}${Constants.mcp_delimiter}${mcpServerName}`;
      const availability = toolAvailabilityMap[serverKey] || toolAvailabilityMap[mcpServerName];

      serversMap.set(mcpServerName, {
        tools: [],
        metadata,
        isConfigured: true,
        serverName: mcpServerName,
        isConnected: connectionStatus?.[mcpServerName]?.connectionState === 'connected',
        consumeOnly: serverConfig?.consumeOnly,
        availability,
      });
    }

    return serversMap;
  }, [mcpData, localize, mcpServerNames, connectionStatus, availableMCPServersMap, toolAvailabilityMap]);

  const value: AgentPanelContextType = {
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
    toolAvailabilityMap,
  };

  return <AgentPanelContext.Provider value={value}>{children}</AgentPanelContext.Provider>;
}
