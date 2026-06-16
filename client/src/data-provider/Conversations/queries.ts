import {
  QueryKeys,
  dataService,
  defaultOrderQuery,
} from 'librechat-data-provider';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UseInfiniteQueryOptions,
  QueryObserverResult,
  UseQueryOptions,
  InfiniteData,
} from '@tanstack/react-query';
import type t from 'librechat-data-provider';
import type {
  ConversationListResponse,
  ConversationListParams,
  MessagesListParams,
  MessagesListResponse,
  SharedLinksListParams,
  SharedLinksResponse,
} from 'librechat-data-provider';
import { conversationCacheService, findConversationInInfinite } from './cacheService';
import { isNotFoundError } from '~/utils';

export const useGetConvoIdQuery = (
  id: string,
  config?: UseQueryOptions<t.TConversation>,
): QueryObserverResult<t.TConversation> => {
  const queryClient = useQueryClient();

  return useQuery<t.TConversation>(
    conversationCacheService.getDetailQueryKey(id),
    () => {
      const convosQuery = queryClient.getQueryData<InfiniteData<ConversationListResponse>>(
        [QueryKeys.allConversations],
        { exact: false },
      );
      const found = findConversationInInfinite(convosQuery, id);

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

export const useConversationsInfiniteQuery = (
  params: ConversationListParams,
  config?: UseInfiniteQueryOptions<ConversationListResponse, unknown>,
) => {
  const { isArchived, sortBy, sortDirection, tags, search, projectId } = params;
  const queryType = isArchived ? 'archived' : 'all';

  return useInfiniteQuery<ConversationListResponse>({
    queryKey: conversationCacheService.getQueryKey(queryType, {
      isArchived,
      sortBy,
      sortDirection,
      tags,
      search,
      projectId,
    }),
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
};

export const useSharedLinksQuery = (
  params: SharedLinksListParams,
  config?: UseInfiniteQueryOptions<SharedLinksResponse, unknown>,
) => {
  const { pageSize, search, sortBy, sortDirection } = params;

  return useInfiniteQuery<SharedLinksResponse>({
    queryKey: [QueryKeys.sharedLinks, { pageSize, search, sortBy, sortDirection }],
    queryFn: ({ pageParam }) =>
      dataService.listSharedLinks({
        cursor: pageParam?.toString(),
        pageSize,
        search,
        sortBy,
        sortDirection,
      }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    ...config,
  });
};

export const useConversationTagsQuery = (
  config?: UseQueryOptions<t.TConversationTagsResponse>,
): QueryObserverResult<t.TConversationTagsResponse> => {
  return useQuery<t.TConversationTag[]>(
    conversationCacheService.getTagsQueryKey(),
    () => dataService.getConversationTags(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export default {
  useGetConvoIdQuery,
  useConversationsInfiniteQuery,
  useSharedLinksQuery,
  useConversationTagsQuery,
};
