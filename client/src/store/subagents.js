import { atomFamily } from 'recoil';
/** Progress state keyed by parent tool_call_id. */
export const subagentProgressByToolCallId = atomFamily({
    key: 'subagentProgressByToolCallId',
    default: null,
});
