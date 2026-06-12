import { useMemo } from 'react';
import { Constants } from 'librechat-data-provider';
import type { TPlugin } from 'librechat-data-provider';
import type { MCPServerInfo } from '~/common';

interface VisibleToolsResult {
  toolIds: string[];
  mcpServerNames: string[];
}

/**
 * Custom hook to calculate visible tool IDs based on selected tools.
 * Separates regular LibreChat tools from MCP servers.
 *
 * @param selectedToolIds - Array of selected tool IDs
 * @param regularTools - Array of regular LibreChat tools
 * @param mcpServersMap - Map of all MCP servers
 * @returns Object containing separate arrays of visible tool IDs for regular and MCP tools
 */
export function useVisibleTools(
  selectedToolIds: string[] | undefined,
  regularTools: TPlugin[] | undefined,
  mcpServersMap: Map<string, MCPServerInfo>,
): VisibleToolsResult {
  return useMemo(() => {
    const mcpServers = new Set<string>();
    const regularToolIds: string[] = [];

    for (const toolId of selectedToolIds ?? []) {
      if (toolId.includes(Constants.mcp_delimiter)) {
        const serverName = toolId.split(Constants.mcp_delimiter)[1];
        if (serverName) {
          const serverInfo = mcpServersMap.get(serverName);
          if (serverInfo?.inspectionFailed) {
            continue;
          }
          if (serverInfo?.requiresOAuth && !serverInfo?.oauthAuthorized) {
            continue;
          }
          mcpServers.add(serverName);
        }
      }
      else if (mcpServersMap.has(toolId)) {
        const serverInfo = mcpServersMap.get(toolId);
        if (serverInfo?.inspectionFailed) {
          continue;
        }
        if (serverInfo?.requiresOAuth && !serverInfo?.oauthAuthorized) {
          continue;
        }
        mcpServers.add(toolId);
      }
      else if (regularTools?.some((t) => t.pluginKey === toolId)) {
        regularToolIds.push(toolId);
      }
    }

    return {
      toolIds: regularToolIds.sort((a, b) => a.localeCompare(b)),
      mcpServerNames: Array.from(mcpServers).sort((a, b) => a.localeCompare(b)),
    };
  }, [regularTools, mcpServersMap, selectedToolIds]);
}
