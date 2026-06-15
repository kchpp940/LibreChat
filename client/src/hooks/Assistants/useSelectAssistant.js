import { useCallback } from 'react';
import { isAssistantsEndpoint } from 'librechat-data-provider';
import useDefaultConvo from '~/hooks/Conversations/useDefaultConvo';
import { useChatContext } from '~/Providers/ChatContext';
import useAssistantListMap from './useAssistantListMap';
import { mapAssistants, logger } from '~/utils';
export default function useSelectAssistant(endpoint) {
    const getDefaultConversation = useDefaultConvo();
    const { conversation, newConversation } = useChatContext();
    const assistantMap = useAssistantListMap((res) => mapAssistants(res.data));
    const onSelect = useCallback((value) => {
        const assistant = assistantMap[endpoint]?.[value];
        if (!assistant) {
            return;
        }
        const template = {
            endpoint,
            assistant_id: assistant.id,
            model: assistant.model,
            conversationId: 'new',
        };
        logger.log('conversation', 'Updating conversation with assistant', assistant);
        if (isAssistantsEndpoint(conversation?.endpoint)) {
            const currentConvo = getDefaultConversation({
                conversation: { ...(conversation ?? {}) },
                preset: template,
            });
            newConversation({
                template: currentConvo,
                preset: template,
            });
            return;
        }
        newConversation({
            template: { ...template },
            preset: template,
        });
    }, [endpoint, assistantMap, conversation, getDefaultConversation, newConversation]);
    return { onSelect };
}
