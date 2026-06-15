import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
export const useProjectsInfiniteQuery = (params = {}, config) => {
    const { sortBy, sortDirection, search, limit } = params;
    return useInfiniteQuery({
        queryKey: [QueryKeys.projects, { sortBy, sortDirection, search, limit }],
        queryFn: ({ pageParam }) => dataService.listProjects({
            sortBy,
            sortDirection,
            search,
            limit,
            cursor: pageParam?.toString(),
        }),
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        keepPreviousData: true,
        staleTime: 5 * 60 * 1000,
        cacheTime: 30 * 60 * 1000,
        ...config,
    });
};
export const useProjectQuery = (projectId, config) => {
    return useQuery([QueryKeys.project, projectId], () => dataService.getProjectById(projectId ?? ''), {
        enabled: Boolean(projectId),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
