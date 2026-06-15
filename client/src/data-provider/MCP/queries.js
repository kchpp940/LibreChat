import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
/**
 * Hook for fetching all accessible MCP servers with permission metadata
 */
export const useMCPServersQuery = (config) => {
    return useQuery([QueryKeys.mcpServers], () => dataService.getMCPServers(), {
        staleTime: 30 * 1000, // 30 seconds — short enough to pick up servers that finish initializing after first load
        refetchOnWindowFocus: true,
        refetchOnReconnect: false,
        refetchOnMount: true,
        retry: false,
        ...config,
    });
};
/**
 * Hook for fetching MCP-specific tools
 * @param config - React Query configuration
 * @returns MCP servers with their tools
 */
export const useMCPToolsQuery = (config) => {
    return useQuery([QueryKeys.mcpTools], () => dataService.getMCPTools(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...config,
    });
};
