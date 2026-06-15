export function areConversationIconFieldsEqual(prevConversation, nextConversation) {
    return (prevConversation.endpoint === nextConversation.endpoint &&
        prevConversation.endpointType === nextConversation.endpointType &&
        prevConversation.iconURL === nextConversation.iconURL &&
        prevConversation.model === nextConversation.model &&
        prevConversation.modelLabel === nextConversation.modelLabel &&
        prevConversation.chatGptLabel === nextConversation.chatGptLabel &&
        prevConversation.spec === nextConversation.spec &&
        prevConversation.agent_id === nextConversation.agent_id &&
        prevConversation.assistant_id === nextConversation.assistant_id);
}
export function areConversationListItemFieldsEqual(prevConversation, nextConversation) {
    return (areConversationIconFieldsEqual(prevConversation, nextConversation) &&
        prevConversation.conversationId === nextConversation.conversationId &&
        prevConversation.title === nextConversation.title &&
        prevConversation.chatProjectId === nextConversation.chatProjectId &&
        prevConversation.createdAt === nextConversation.createdAt &&
        prevConversation.updatedAt === nextConversation.updatedAt);
}
export function areConversationRenderPropsEqual(prevProps, nextProps) {
    return (areConversationListItemFieldsEqual(prevProps.conversation, nextProps.conversation) &&
        prevProps.isGenerating === nextProps.isGenerating);
}
