import { useConversationCache } from '~/data-provider';

const useUpdateTagsInConvo = () => {
  const cache = useConversationCache();

  const updateTagsInConversation = (conversationId: string, tags: string[]) => {
    cache.updateTags(conversationId, tags);
  };

  const replaceTagsInAllConversations = (tag: string, newTag: string) => {
    cache.replaceTagInAllConversations(tag, newTag);
  };

  return { updateTagsInConversation, replaceTagsInAllConversations };
};

export default useUpdateTagsInConvo;
