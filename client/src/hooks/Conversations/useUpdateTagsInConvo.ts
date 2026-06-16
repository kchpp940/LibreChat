import { useQueryClient } from '@tanstack/react-query';
import { conversationCacheService } from '~/data-provider';

const useUpdateTagsInConvo = () => {
  const queryClient = useQueryClient();

  const updateTagsInConversation = (conversationId: string, tags: string[]) => {
    conversationCacheService.updateTagsInConversation(queryClient, conversationId, tags);
  };

  const replaceTagsInAllConversations = (tag: string, newTag: string) => {
    conversationCacheService.replaceTagInAllConversations(queryClient, tag, newTag);
  };

  return { updateTagsInConversation, replaceTagsInAllConversations };
};

export default useUpdateTagsInConvo;
