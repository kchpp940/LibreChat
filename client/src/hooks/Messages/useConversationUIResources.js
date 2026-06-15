import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { Tools } from 'librechat-data-provider';
import { useOptionalMessagesOperations } from '~/Providers';
import store from '~/store';
/**
 * Hook to collect all UI resources in a conversation, indexed by resource ID.
 * This enables cross-turn resource references in the conversation.
 * Works in both main app (using React Query cache) and share view (using context messages).
 *
 * @param conversationId - The ID of the conversation to collect resources from
 * @returns A Map of resource IDs to UIResource objects
 */
export function useConversationUIResources(conversationId) {
    const { getMessages } = useOptionalMessagesOperations();
    const conversationAttachmentsMap = useRecoilValue(store.conversationAttachmentsSelector(conversationId));
    return useMemo(() => {
        const map = new Map();
        const collectResources = (attachments) => {
            attachments
                ?.filter((attachment) => attachment?.type === Tools.ui_resources)
                .forEach((attachment) => {
                const resources = attachment?.[Tools.ui_resources];
                if (Array.isArray(resources)) {
                    resources.forEach((resource) => {
                        if (resource?.resourceId) {
                            map.set(resource.resourceId, resource);
                        }
                    });
                }
            });
        };
        // Collect from messages (works in both main app and share view)
        getMessages()?.forEach((message) => {
            collectResources(message.attachments);
        });
        // Collect from in-flight messages (Recoil state during streaming - only when we have a conversationId)
        if (conversationId) {
            Object.values(conversationAttachmentsMap).forEach(collectResources);
        }
        return map;
    }, [conversationId, getMessages, conversationAttachmentsMap]);
}
