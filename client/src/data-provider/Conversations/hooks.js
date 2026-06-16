import { useMemo } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { isNotFoundError } from '~/utils';
import {
  convoQueryKeys,
  flattenConversations,
  hasNextPage,
  findConversationInData,
  useConversationCacheService,
} from './cacheService';

export const useConversationListQuery = (params = {}, config) => {
  const { isArchived, sortBy, sortDirection, tags, search, projectId } = params;

  const queryResult = useInfiniteQuery({
    queryKey: convoQueryKeys.list(params),
    queryFn: ({ pageParam }) =>
      dataService.listConversations({
        isArchived,
        sortBy,
        sortDirection,
        tags,
        search,
        projectId,
        cursor: pageParam?.toString(),
      }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    ...config,
  });

  const conversations = useMemo(
    () => flattenConversations(queryResult.data),
    [queryResult.data],
  );

  const hasNext = useMemo(() => hasNextPage(queryResult.data), [queryResult.data]);

  return {
    ...queryResult,
    conversations,
    hasNext,
  };
};

export const useConversationByIdQuery = (id, config) => {
  const queryClient = useQueryClient();

  return useQuery(
    convoQueryKeys.single(id),
    () => {
      const convosQuery = queryClient.getQueryData(
        [QueryKeys.allConversations],
        { exact: false },
      );
      const found = findConversationInData(convosQuery, id);

      if (found && found.messages != null) {
        return found;
      }
      return dataService.getConversationById(id);
    },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (isNotFoundError(error)) {
          return false;
        }
        return failureCount < 3;
      },
      ...config,
    },
  );
};

export const useConversationCache = () => {
  const queryClient = useQueryClient();
  return useMemo(() => useConversationCacheService(queryClient), [queryClient]);
};
