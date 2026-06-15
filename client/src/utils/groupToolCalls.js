import { Constants, ContentTypes, ToolCallTypes } from 'librechat-data-provider';
function isGroupableToolCall(part) {
    if (part.type !== ContentTypes.TOOL_CALL) {
        return false;
    }
    const toolCall = part[ContentTypes.TOOL_CALL];
    if (!toolCall) {
        return false;
    }
    const isStandardToolCall = 'args' in toolCall && (!toolCall.type || toolCall.type === ToolCallTypes.TOOL_CALL);
    if (isStandardToolCall && toolCall.name?.startsWith(Constants.LC_TRANSFER_TO_)) {
        return false;
    }
    return true;
}
export function groupSequentialToolCalls(parts) {
    const result = [];
    let currentGroup = [];
    const flushGroup = () => {
        if (currentGroup.length >= 2) {
            result.push({ type: 'tool-group', parts: [...currentGroup] });
        }
        else {
            for (const p of currentGroup) {
                result.push({ type: 'single', part: p });
            }
        }
        currentGroup = [];
    };
    for (const item of parts) {
        if (isGroupableToolCall(item.part)) {
            currentGroup.push(item);
        }
        else {
            flushGroup();
            result.push({ type: 'single', part: item });
        }
    }
    flushGroup();
    return result;
}
