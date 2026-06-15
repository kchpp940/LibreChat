import { useRecoilValue } from 'recoil';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { useQuery } from '@tanstack/react-query';
import store from '~/store';
export const useGetEndpointsQuery = (config) => {
    const queriesEnabled = useRecoilValue(store.queriesEnabled);
    return useQuery([QueryKeys.endpoints], () => dataService.getAIEndpoints(), {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
        enabled: (config?.enabled ?? true) === true && queriesEnabled,
    });
};
/**
 * Auth-aware query key so unauthenticated (login page) and authenticated
 * (chat page) configs are cached independently, preventing stale
 * unauthenticated config from persisting after login.
 */
export const startupConfigKey = (isAuthenticated, context) => [QueryKeys.startupConfig, isAuthenticated, context ?? 'default'];
export const useGetStartupConfig = (config, options) => {
    const queriesEnabled = useRecoilValue(store.queriesEnabled);
    const user = useRecoilValue(store.user);
    return useQuery(startupConfigKey(!!user, options?.context), () => dataService.getStartupConfig({ context: options?.context }), {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
        enabled: (config?.enabled ?? true) === true && queriesEnabled,
    });
};
