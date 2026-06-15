import { atom, selectorFamily } from 'recoil';
import { atomWithLocalStorage } from './utils';
const hideBannerHint = atomWithLocalStorage('hideBannerHint', []);
const messageAttachmentsMap = atom({
    key: 'messageAttachmentsMap',
    default: {},
});
/**
 * Selector to get attachments for a specific conversation.
 */
const conversationAttachmentsSelector = selectorFamily({
    key: 'conversationAttachments',
    get: (conversationId) => ({ get }) => {
        if (!conversationId) {
            return {};
        }
        const attachmentsMap = get(messageAttachmentsMap);
        const result = {};
        // Filter to only include attachments for this conversation
        Object.entries(attachmentsMap).forEach(([messageId, attachments]) => {
            if (!attachments || attachments.length === 0) {
                return;
            }
            const relevantAttachments = attachments.filter((attachment) => attachment.conversationId === conversationId);
            if (relevantAttachments.length > 0) {
                result[messageId] = relevantAttachments;
            }
        });
        return result;
    },
});
const queriesEnabled = atom({
    key: 'queriesEnabled',
    default: true,
});
const isEditingBadges = atom({
    key: 'isEditingBadges',
    default: false,
});
const chatBadges = atomWithLocalStorage('chatBadges', [
    // When adding new badges, make sure to add them to useChatBadges.ts as well and add them as last item
    // DO NOT CHANGE THE ORDER OF THE BADGES ALREADY IN THE ARRAY
    { id: '1' },
    // { id: '2' },
]);
export default {
    hideBannerHint,
    messageAttachmentsMap,
    conversationAttachmentsSelector,
    queriesEnabled,
    isEditingBadges,
    chatBadges,
};
