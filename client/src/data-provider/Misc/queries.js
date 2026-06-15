import { useRecoilValue } from 'recoil';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { useQuery } from '@tanstack/react-query';
import store from '~/store';
export const useGetBannerQuery = (config) => {
    const queriesEnabled = useRecoilValue(store.queriesEnabled);
    return useQuery([QueryKeys.banner], () => dataService.getBanner(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
        enabled: (config?.enabled ?? true) === true && queriesEnabled,
    });
};
export const useGetUserBalance = (config) => {
    const queriesEnabled = useRecoilValue(store.queriesEnabled);
    return useQuery([QueryKeys.balance], () => dataService.getUserBalance(), {
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        ...config,
        enabled: (config?.enabled ?? true) === true && queriesEnabled,
    });
};
export const useGetSearchEnabledQuery = (config) => {
    const queriesEnabled = useRecoilValue(store.queriesEnabled);
    return useQuery([QueryKeys.searchEnabled], () => dataService.getSearchEnabled(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
        enabled: (config?.enabled ?? true) === true && queriesEnabled,
    });
};
