import { useConversationCache } from '~/data-provider';
const useUpdateTagsInConvo = () => {
    const cache = useConversationCache();
    const updateTagsInConversation = (conversationId, tags) => {
        cache.updateTags(conversationId, tags);
    };
    const replaceTagsInAllConversations = (tag, newTag) => {
        cache.replaceTagInAllConversations(tag, newTag);
    };
    return { updateTagsInConversation, replaceTagsInAllConversations };
};
export default useUpdateTagsInConvo;
