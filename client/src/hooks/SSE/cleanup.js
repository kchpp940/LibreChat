import { Constants } from 'librechat-data-provider';
export function shouldResetSubagentAtomsOnConversationChange(previous, next, preserveNewConversationId) {
    if (previous == null || previous === next)
        return false;
    if (previous === Constants.NEW_CONVO && next === preserveNewConversationId)
        return false;
    return true;
}
