import { useMemo } from 'react';
import { useGetToolCalls } from '~/data-provider';
import { mapToolCalls, logger } from '~/utils';
export default function useToolCallsMap({ conversationId, }) {
    const { data: toolCallsMap = null } = useGetToolCalls({ conversationId }, {
        select: (res) => mapToolCalls(res),
    });
    const result = useMemo(() => {
        return toolCallsMap !== null ? toolCallsMap : undefined;
    }, [toolCallsMap]);
    logger.log('tools', 'tool calls map:', result);
    return result;
}
