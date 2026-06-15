import { dataService, QueryKeys, Tools } from 'librechat-data-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export const useToolCallMutation = (toolId, options) => {
    const queryClient = useQueryClient();
    return useMutation((toolParams) => {
        return dataService.callTool({
            toolId,
            toolParams,
        });
    }, {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (response, variables, context) => {
            queryClient.setQueryData([QueryKeys.toolCalls, variables.conversationId], (prev) => [
                ...(prev ?? []),
                {
                    user: '',
                    toolId: Tools.execute_code,
                    partIndex: variables.partIndex,
                    messageId: variables.messageId,
                    blockIndex: variables.blockIndex,
                    conversationId: variables.conversationId,
                    result: response.result,
                    attachments: response.attachments,
                },
            ]);
            return options?.onSuccess?.(response, variables, context);
        },
    });
};
