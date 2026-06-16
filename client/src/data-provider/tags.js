import { useQuery } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';
import { convoQueryKeys } from './Conversations';
export const useGetConversationTags = (config) => {
    return useQuery(convoQueryKeys.tags(), () => dataService.getConversationTags(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
