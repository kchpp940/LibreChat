export const isTemporaryConversation = (conversation) => conversation?.isTemporary === true ||
    (conversation?.isTemporary === undefined && conversation?.expiredAt != null);
