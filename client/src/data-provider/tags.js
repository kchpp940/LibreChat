import { useQuery } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';
import { conversationCacheService } from './Conversations/cacheService';
export const useGetConversationTags = (config) => {
    return useQuery(conversationCacheService.getTagsQueryKey(), () => dataService.getConversationTags(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
