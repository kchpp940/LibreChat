import { useQuery } from '@tanstack/react-query';
import { Constants, QueryKeys, dataService } from 'librechat-data-provider';
export const useVerifyAgentToolAuth = (params, config) => {
    return useQuery([QueryKeys.toolAuth, params.toolId], () => dataService.getVerifyAgentToolAuth(params), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
export const useGetToolCalls = (params, config) => {
    const { conversationId = '' } = params;
    return useQuery([QueryKeys.toolCalls, conversationId], () => dataService.getToolCalls(params), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        enabled: conversationId.length > 0 &&
            conversationId !== Constants.NEW_CONVO &&
            conversationId !== Constants.PENDING_CONVO &&
            conversationId !== Constants.SEARCH,
        ...config,
    });
};
export const useMCPConnectionStatusQuery = (config) => {
    return useQuery([QueryKeys.mcpConnectionStatus], () => dataService.getMCPConnectionStatus(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        staleTime: 10000, // 10 seconds
        ...config,
    });
};
export const useMCPAuthValuesQuery = (serverName, config) => {
    return useQuery([QueryKeys.mcpAuthValues, serverName], () => dataService.getMCPAuthValues(serverName), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        enabled: !!serverName,
        ...config,
    });
};
