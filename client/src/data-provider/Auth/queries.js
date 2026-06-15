import { useRecoilValue } from 'recoil';
import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import store from '~/store';
export const useGetUserQuery = (config) => {
    const queriesEnabled = useRecoilValue(store.queriesEnabled);
    return useQuery([QueryKeys.user], () => dataService.getUser(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: (config?.enabled ?? true) === true && queriesEnabled,
    });
};
export const useGraphTokenQuery = (options = {}, config) => {
    const { scopes, enabled = false } = options;
    return useQuery({
        queryKey: [QueryKeys.graphToken, scopes],
        queryFn: () => dataService.getGraphApiToken({ scopes: scopes ?? '' }),
        enabled,
        staleTime: 50 * 60 * 1000, // 50 minutes (tokens expire in 60 minutes)
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
