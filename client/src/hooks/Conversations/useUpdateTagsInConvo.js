import { useQueryClient } from '@tanstack/react-query';
import { conversationCacheService } from '~/data-provider';
const useUpdateTagsInConvo = () => {
    const queryClient = useQueryClient();
    const updateTagsInConversation = (conversationId, tags) => {
        conversationCacheService.updateTagsInConversation(queryClient, conversationId, tags);
    };
    const replaceTagsInAllConversations = (tag, newTag) => {
        conversationCacheService.replaceTagInAllConversations(queryClient, tag, newTag);
    };
    return { updateTagsInConversation, replaceTagsInAllConversations };
};
export default useUpdateTagsInConvo;
