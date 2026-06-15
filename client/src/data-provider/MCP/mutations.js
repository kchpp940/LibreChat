import { dataService, QueryKeys, ResourceType } from 'librechat-data-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
/**
 * Hook for creating a new MCP server
 */
export const useCreateMCPServerMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation((data) => dataService.createMCPServer(data), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (newServer, variables, context) => {
            const listRes = queryClient.getQueryData([QueryKeys.mcpServers]);
            if (listRes) {
                queryClient.setQueryData([QueryKeys.mcpServers], {
                    ...listRes,
                    [newServer.serverName]: newServer,
                });
            }
            queryClient.invalidateQueries([QueryKeys.mcpServers]);
            queryClient.invalidateQueries([QueryKeys.mcpTools]);
            queryClient.invalidateQueries([QueryKeys.mcpAuthValues]);
            queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);
            queryClient.invalidateQueries([
                QueryKeys.effectivePermissions,
                'all',
                ResourceType.MCPSERVER,
            ]);
            return options?.onSuccess?.(newServer, variables, context);
        },
    });
};
/**
 * Hook for updating an existing MCP server
 */
export const useUpdateMCPServerMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ serverName, data }) => dataService.updateMCPServer(serverName, data), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (updatedServer, variables, context) => {
            // Update list cache
            const listRes = queryClient.getQueryData([QueryKeys.mcpServers]);
            if (listRes) {
                const oldServer = listRes[variables.serverName];
                listRes[variables.serverName] = {
                    ...updatedServer,
                    dbId: updatedServer.dbId ?? oldServer?.dbId,
                    consumeOnly: updatedServer.consumeOnly ?? oldServer?.consumeOnly,
                };
                queryClient.setQueryData([QueryKeys.mcpServers], {
                    ...listRes,
                });
            }
            queryClient.setQueryData([QueryKeys.mcpServer, variables.serverName], updatedServer);
            queryClient.invalidateQueries([QueryKeys.mcpServers]);
            queryClient.invalidateQueries([QueryKeys.mcpTools]);
            queryClient.invalidateQueries([QueryKeys.mcpAuthValues]);
            queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);
            return options?.onSuccess?.(updatedServer, variables, context);
        },
    });
};
/**
 * Hook for deleting an MCP server
 */
export const useDeleteMCPServerMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation((serverName) => dataService.deleteMCPServer(serverName), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (_data, serverName, context) => {
            // Update list cache by removing the deleted server (immutable update)
            const listRes = queryClient.getQueryData([QueryKeys.mcpServers]);
            if (listRes) {
                const { [serverName]: _removed, ...remaining } = listRes;
                queryClient.setQueryData([QueryKeys.mcpServers], remaining);
            }
            // Remove from specific server query cache
            queryClient.removeQueries([QueryKeys.mcpServer, serverName]);
            // Invalidate list query to ensure consistency
            queryClient.invalidateQueries([QueryKeys.mcpServers]);
            queryClient.invalidateQueries([QueryKeys.mcpTools]);
            queryClient.invalidateQueries([QueryKeys.mcpAuthValues]);
            queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);
            return options?.onSuccess?.(_data, serverName, context);
        },
    });
};
