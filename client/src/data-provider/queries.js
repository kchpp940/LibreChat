import { QueryKeys, dataService, EModelEndpoint, isAgentsEndpoint, defaultOrderQuery, defaultAssistantsVersion, } from 'librechat-data-provider';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { findConversationInInfinite, isNotFoundError, isRetryableError } from '~/utils';
export const useGetPresetsQuery = (config) => {
    return useQuery([QueryKeys.presets], () => dataService.getPresets(), {
        staleTime: 1000 * 10,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
export const useGetConvoIdQuery = (id, config) => {
    const queryClient = useQueryClient();
    return useQuery([QueryKeys.conversation, id], () => {
        // Try to find in all fetched infinite pages
        const convosQuery = queryClient.getQueryData([QueryKeys.allConversations], { exact: false });
        const found = findConversationInInfinite(convosQuery, id);
        if (found && found.messages != null) {
            return found;
        }
        // Otherwise, fetch from API
        return dataService.getConversationById(id);
    }, {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: (failureCount, error) => {
            if (!isRetryableError(error) || isNotFoundError(error)) {
                return false;
            }
            return failureCount < 3;
        },
        ...config,
    });
};
export const useConversationsInfiniteQuery = (params, config) => {
    const { isArchived, sortBy, sortDirection, tags, search, projectId } = params;
    return useInfiniteQuery({
        queryKey: [
            isArchived ? QueryKeys.archivedConversations : QueryKeys.allConversations,
            { isArchived, sortBy, sortDirection, tags, search, projectId },
        ],
        queryFn: ({ pageParam }) => dataService.listConversations({
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
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        ...config,
    });
};
export const useMessagesInfiniteQuery = (params, config) => {
    const { sortBy, sortDirection, pageSize, conversationId, messageId, search, searchTypes } = params;
    return useInfiniteQuery({
        queryKey: [
            QueryKeys.messages,
            { sortBy, sortDirection, pageSize, conversationId, messageId, search, searchTypes },
        ],
        queryFn: ({ pageParam }) => dataService.listMessages({
            sortBy,
            sortDirection,
            pageSize,
            conversationId,
            messageId,
            search,
            searchTypes,
            cursor: pageParam?.toString(),
        }),
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        keepPreviousData: true,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        ...config,
    });
};
export const useSharedLinksQuery = (params, config) => {
    const { pageSize, search, sortBy, sortDirection } = params;
    return useInfiniteQuery({
        queryKey: [QueryKeys.sharedLinks, { pageSize, search, sortBy, sortDirection }],
        queryFn: ({ pageParam }) => dataService.listSharedLinks({
            cursor: pageParam?.toString(),
            pageSize,
            search,
            sortBy,
            sortDirection,
        }),
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        keepPreviousData: true,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        ...config,
    });
};
export const useConversationTagsQuery = (config) => {
    return useQuery([QueryKeys.conversationTags], () => dataService.getConversationTags(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
/**
 * ASSISTANTS
 */
/**
 * Hook for getting available LibreChat tools (excludes MCP tools)
 * For MCP tools, use `useMCPToolsQuery` from mcp-queries.ts
 */
export const useAvailableToolsQuery = (endpoint, config) => {
    const queryClient = useQueryClient();
    const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
    const keyExpiry = queryClient.getQueryData([QueryKeys.name, endpoint]);
    const userProvidesKey = !!endpointsConfig?.[endpoint]?.userProvide;
    const keyProvided = userProvidesKey ? !!keyExpiry?.expiresAt : true;
    const enabled = isAgentsEndpoint(endpoint) ? true : !!endpointsConfig?.[endpoint] && keyProvided;
    const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
    return useQuery([QueryKeys.tools], () => dataService.getAvailableTools(endpoint, version), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        enabled,
        ...config,
    });
};
/**
 * Hook for listing all assistants, with optional parameters provided for pagination and sorting
 */
export const useListAssistantsQuery = (endpoint, params = defaultOrderQuery, config) => {
    const queryClient = useQueryClient();
    const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
    const keyExpiry = queryClient.getQueryData([QueryKeys.name, endpoint]);
    const userProvidesKey = !!(endpointsConfig?.[endpoint]?.userProvide ?? false);
    const keyProvided = userProvidesKey ? !!(keyExpiry?.expiresAt ?? '') : true;
    const enabled = !!endpointsConfig?.[endpoint] && keyProvided;
    const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
    return useQuery([QueryKeys.assistants, endpoint, params], () => dataService.listAssistants({ ...params, endpoint }, version), {
        // Example selector to sort them by created_at
        // select: (res) => {
        //   return res.data.sort((a, b) => a.created_at - b.created_at);
        // },
        staleTime: 1000 * 5,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: config?.enabled !== undefined ? config.enabled && enabled : enabled,
    });
};
/*
export const useListAssistantsInfiniteQuery = (
  params?: AssistantListParams,
  config?: UseInfiniteQueryOptions<AssistantListResponse, Error>,
) => {
  const queryClient = useQueryClient();
  const endpointsConfig = queryClient.getQueryData<TEndpointsConfig>([QueryKeys.endpoints]);
  const keyExpiry = queryClient.getQueryData<TCheckUserKeyResponse>([
    QueryKeys.name,
    EModelEndpoint.assistants,
  ]);
  const userProvidesKey = !!endpointsConfig?.[EModelEndpoint.assistants]?.userProvide;
  const keyProvided = userProvidesKey ? !!keyExpiry?.expiresAt : true;
  const enabled = !!endpointsConfig?.[EModelEndpoint.assistants] && keyProvided;
  return useInfiniteQuery<AssistantListResponse, Error>(
    ['assistantsList', params],
    ({ pageParam = '' }) => dataService.listAssistants({ ...params, after: pageParam }),
    {
      getNextPageParam: (lastPage) => {
        // lastPage is of type AssistantListResponse, you can use the has_more and last_id from it directly
        if (lastPage.has_more) {
          return lastPage.last_id;
        }
        return undefined;
      },
      ...config,
      enabled: config?.enabled !== undefined ? config?.enabled && enabled : enabled,
    },
  );
};
*/
/**
 * Hook for retrieving details about a single assistant
 */
export const useGetAssistantByIdQuery = (endpoint, assistant_id, config) => {
    const queryClient = useQueryClient();
    const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
    const keyExpiry = queryClient.getQueryData([QueryKeys.name, endpoint]);
    const userProvidesKey = endpointsConfig?.[endpoint]?.userProvide ?? false;
    const keyProvided = userProvidesKey ? !!keyExpiry?.expiresAt : true;
    const enabled = !!endpointsConfig?.[endpoint] && keyProvided;
    const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
    return useQuery([QueryKeys.assistant, assistant_id], () => dataService.getAssistantById({
        endpoint,
        assistant_id,
        version,
    }), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        // Query will not execute until the assistant_id exists
        enabled: config?.enabled !== undefined ? config.enabled && enabled : enabled,
    });
};
/**
 * Hook for retrieving user's saved Assistant Actions
 */
export const useGetActionsQuery = (endpoint, config) => {
    const queryClient = useQueryClient();
    const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
    const keyExpiry = queryClient.getQueryData([QueryKeys.name, endpoint]);
    const userProvidesKey = !!endpointsConfig?.[endpoint]?.userProvide;
    const keyProvided = userProvidesKey ? !!keyExpiry?.expiresAt : true;
    const enabled = (!!endpointsConfig?.[endpoint] && keyProvided) || endpoint === EModelEndpoint.agents;
    return useQuery([QueryKeys.actions], () => dataService.getActions(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
        enabled: config?.enabled !== undefined ? config.enabled && enabled : enabled,
    });
};
/**
 * Hook for retrieving user's saved Assistant Documents (metadata saved to Database)
 */
export const useGetAssistantDocsQuery = (endpoint, config) => {
    const queryClient = useQueryClient();
    const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
    const keyExpiry = queryClient.getQueryData([QueryKeys.name, endpoint]);
    const userProvidesKey = !!(endpointsConfig?.[endpoint]?.userProvide ?? false);
    const keyProvided = userProvidesKey ? !!(keyExpiry?.expiresAt ?? '') : true;
    const enabled = !!endpointsConfig?.[endpoint] && keyProvided;
    const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
    return useQuery([QueryKeys.assistantDocs, endpoint], () => dataService.getAssistantDocs({
        endpoint,
        version,
    }), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
        enabled: config?.enabled !== undefined ? config.enabled && enabled : enabled,
    });
};
/** STT/TTS */
/* Text to speech voices */
export const useVoicesQuery = (config) => {
    return useQuery([QueryKeys.voices], () => dataService.getVoices(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
    });
};
/* Custom config speech */
export const useCustomConfigSpeechQuery = (config) => {
    return useQuery([QueryKeys.customConfigSpeech], () => dataService.getCustomConfigSpeech(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
    });
};
/** Prompt */
export const usePromptGroupsInfiniteQuery = (params, config) => {
    const { name, pageSize, category } = params || {};
    return useInfiniteQuery([QueryKeys.promptGroups, name, category, pageSize], ({ pageParam }) => {
        const queryParams = {
            name,
            category: category || '',
            limit: (pageSize || 10).toString(),
        };
        // Only add cursor if it's a valid string
        if (pageParam && typeof pageParam === 'string') {
            queryParams.cursor = pageParam;
        }
        return dataService.getPromptGroups(queryParams);
    }, {
        getNextPageParam: (lastPage) => {
            // Use cursor-based pagination - ensure we return a valid cursor or undefined
            return lastPage.has_more && lastPage.after ? lastPage.after : undefined;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
export const useGetPromptGroup = (id, config) => {
    return useQuery([QueryKeys.promptGroup, id], () => dataService.getPromptGroup(id), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: config?.enabled !== undefined ? config.enabled : true,
    });
};
export const useGetPrompts = (filter, config) => {
    return useQuery([QueryKeys.prompts, filter.groupId ?? ''], () => dataService.getPrompts(filter), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: config?.enabled !== undefined ? config.enabled : true,
    });
};
export const useGetAllPromptGroups = (filter, config) => {
    return useQuery([QueryKeys.allPromptGroups], () => dataService.getAllPromptGroups(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
    });
};
export const useGetCategories = (config) => {
    return useQuery([QueryKeys.categories], () => dataService.getCategories(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: config?.enabled !== undefined ? config.enabled : true,
    });
};
export const useGetRandomPrompts = (filter, config) => {
    return useQuery([QueryKeys.randomPrompts], () => dataService.getRandomPrompts(filter), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: false,
        ...config,
        enabled: config?.enabled !== undefined ? config.enabled : true,
    });
};
export const useUserTermsQuery = (config) => {
    return useQuery([QueryKeys.userTerms], () => dataService.getUserTerms(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
