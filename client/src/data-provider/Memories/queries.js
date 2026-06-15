/* Memories */
import { QueryKeys, MutationKeys, dataService } from 'librechat-data-provider';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
export const useMemoriesQuery = (config) => {
    return useQuery([QueryKeys.memories], () => dataService.getMemories(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
export const useDeleteMemoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((key) => dataService.deleteMemory(key), {
        onSuccess: () => {
            queryClient.invalidateQueries([QueryKeys.memories]);
        },
    });
};
export const useUpdateMemoryMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ key, value, originalKey }) => dataService.updateMemory(key, value, originalKey), {
        ...options,
        onSuccess: (...params) => {
            queryClient.invalidateQueries([QueryKeys.memories]);
            options?.onSuccess?.(...params);
        },
    });
};
export const useUpdateMemoryPreferencesMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation([MutationKeys.updateMemoryPreferences], (preferences) => dataService.updateMemoryPreferences(preferences), {
        ...options,
        onSuccess: (...params) => {
            queryClient.invalidateQueries([QueryKeys.user]);
            options?.onSuccess?.(...params);
        },
    });
};
export const useCreateMemoryMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ key, value }) => dataService.createMemory({ key, value }), {
        ...options,
        onSuccess: (data, variables, context) => {
            queryClient.setQueryData([QueryKeys.memories], (oldData) => {
                if (!oldData)
                    return oldData;
                const newMemories = [...oldData.memories, data.memory];
                const totalTokens = newMemories.reduce((sum, memory) => sum + (memory.tokenCount || 0), 0);
                const tokenLimit = oldData.tokenLimit;
                let usagePercentage = oldData.usagePercentage;
                if (tokenLimit && tokenLimit > 0) {
                    usagePercentage = Math.min(100, Math.round((totalTokens / tokenLimit) * 100));
                }
                return {
                    ...oldData,
                    memories: newMemories,
                    totalTokens,
                    usagePercentage,
                };
            });
            options?.onSuccess?.(data, variables, context);
        },
    });
};
