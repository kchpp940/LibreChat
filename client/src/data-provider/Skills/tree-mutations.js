import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
export const useCreateSkillNodeMutation = (skillId, options) => {
    const queryClient = useQueryClient();
    return useMutation((body) => dataService.createSkillNode(body.skillId, body.data), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (newNode, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.skillTree, skillId]);
            return options?.onSuccess?.(newNode, variables, context);
        },
    });
};
export const useUpdateSkillNodeMutation = (skillId, options) => {
    const queryClient = useQueryClient();
    return useMutation((vars) => dataService.updateSkillNode(vars), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (updated, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.skillTree, skillId]);
            queryClient.invalidateQueries([QueryKeys.skillNodeContent, skillId, variables.nodeId]);
            return options?.onSuccess?.(updated, variables, context);
        },
    });
};
export const useDeleteSkillNodeMutation = (skillId, options) => {
    const queryClient = useQueryClient();
    return useMutation((vars) => dataService.deleteSkillNode(vars), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (result, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.skillTree, skillId]);
            return options?.onSuccess?.(result, variables, context);
        },
    });
};
export const useUpdateSkillNodeContentMutation = (skillId, options) => {
    const queryClient = useQueryClient();
    return useMutation((vars) => dataService.updateSkillNodeContent(vars), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (updated, variables, context) => {
            queryClient.invalidateQueries([QueryKeys.skillNodeContent, skillId, variables.nodeId]);
            return options?.onSuccess?.(updated, variables, context);
        },
    });
};
