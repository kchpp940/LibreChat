import { useRecoilValue } from 'recoil';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { 
/* Prompts */
addGroupToAll, addPromptGroup, updateGroupInAll, updateGroupFields, updateGroupFieldsInPlace, deletePromptGroup, removeGroupFromAll, } from '~/utils';
import store from '~/store';
export const useUpdatePromptGroup = (options) => {
    const { onMutate, onError, onSuccess } = options || {};
    const queryClient = useQueryClient();
    const name = useRecoilValue(store.promptsName);
    const pageSize = useRecoilValue(store.promptsPageSize);
    const category = useRecoilValue(store.promptsCategory);
    return useMutation({
        mutationFn: (variables) => dataService.updatePromptGroup(variables),
        onMutate: (variables) => {
            const groupData = queryClient.getQueryData([
                QueryKeys.promptGroup,
                variables.id,
            ]);
            const group = groupData ? structuredClone(groupData) : undefined;
            const groupListData = queryClient.getQueryData([
                QueryKeys.promptGroups,
                name,
                category,
                pageSize,
            ]);
            const previousListData = groupListData ? structuredClone(groupListData) : undefined;
            const update = variables.payload;
            if (groupListData) {
                const newData = updateGroupFields(
                /* Paginated Data */
                groupListData, 
                /* Update */
                { _id: variables.id, ...update }, 
                /* Callback */
                (group) => queryClient.setQueryData([QueryKeys.promptGroup, variables.id], group));
                queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], newData);
            }
            if (onMutate) {
                onMutate(variables);
            }
            return { group, previousListData };
        },
        onError: (err, variables, context) => {
            if (context?.group) {
                queryClient.setQueryData([QueryKeys.promptGroup, variables.id], context.group);
            }
            if (context?.previousListData) {
                queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], context.previousListData);
            }
            if (onError) {
                onError(err, variables, context);
            }
        },
        onSuccess: (response, variables, context) => {
            updateGroupInAll(queryClient, { _id: variables.id, ...response });
            if (onSuccess) {
                onSuccess(response, variables, context);
            }
        },
    });
};
export const useCreatePrompt = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ...rest } = options || {};
    const name = useRecoilValue(store.promptsName);
    const pageSize = useRecoilValue(store.promptsPageSize);
    const category = useRecoilValue(store.promptsCategory);
    return useMutation({
        mutationFn: (payload) => dataService.createPrompt(payload),
        ...rest,
        onSuccess: (response, variables, context) => {
            const { prompt, group } = response;
            queryClient.setQueryData([QueryKeys.prompts, variables.prompt.groupId], (oldData) => {
                return [prompt, ...(oldData ?? [])];
            });
            if (group) {
                queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], (data) => {
                    if (!data) {
                        return data;
                    }
                    return addPromptGroup(data, group);
                });
                addGroupToAll(queryClient, group);
            }
            if (onSuccess) {
                onSuccess(response, variables, context);
            }
        },
    });
};
export const useAddPromptToGroup = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ...rest } = options || {};
    return useMutation({
        mutationFn: ({ groupId, ...payload }) => dataService.addPromptToGroup(groupId, payload),
        ...rest,
        onSuccess: (response, variables, context) => {
            const { prompt } = response;
            queryClient.setQueryData([QueryKeys.prompts, variables.prompt.groupId], (oldData) => {
                return [prompt, ...(oldData ?? [])];
            });
            if (onSuccess) {
                onSuccess(response, variables, context);
            }
        },
    });
};
export const useDeletePrompt = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ...rest } = options || {};
    const name = useRecoilValue(store.promptsName);
    const pageSize = useRecoilValue(store.promptsPageSize);
    const category = useRecoilValue(store.promptsCategory);
    return useMutation({
        mutationFn: (payload) => dataService.deletePrompt(payload),
        ...rest,
        onSuccess: (response, variables, context) => {
            if (response.promptGroup) {
                const promptGroupId = response.promptGroup.id;
                queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], (data) => {
                    if (!data) {
                        return data;
                    }
                    return deletePromptGroup(data, promptGroupId);
                });
                removeGroupFromAll(queryClient, promptGroupId);
            }
            else {
                queryClient.setQueryData([QueryKeys.prompts, variables.groupId], (oldData) => {
                    const prompts = oldData ? oldData.filter((prompt) => prompt._id !== variables._id) : [];
                    queryClient.setQueryData([QueryKeys.promptGroup, variables.groupId], (data) => {
                        if (!data) {
                            return data;
                        }
                        if (data.productionId === variables._id) {
                            return { ...data, productionId: prompts[0]?._id, productionPrompt: prompts[0] };
                        }
                        return data;
                    });
                    return prompts;
                });
            }
            if (onSuccess) {
                onSuccess(response, variables, context);
            }
        },
    });
};
export const useDeletePromptGroup = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ...rest } = options || {};
    const name = useRecoilValue(store.promptsName);
    const pageSize = useRecoilValue(store.promptsPageSize);
    const category = useRecoilValue(store.promptsCategory);
    return useMutation({
        mutationFn: (variables) => dataService.deletePromptGroup(variables.id),
        ...rest,
        onSuccess: (response, variables, context) => {
            queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], (data) => {
                if (!data) {
                    return data;
                }
                return deletePromptGroup(data, variables.id);
            });
            removeGroupFromAll(queryClient, variables.id);
            if (onSuccess) {
                onSuccess(response, variables, context);
            }
        },
    });
};
export const useUpdatePromptLabels = (options) => {
    const { onSuccess, ...rest } = options || {};
    return useMutation({
        mutationFn: (variables) => dataService.updatePromptLabels(variables),
        ...rest,
        onSuccess: (response, variables, context) => {
            if (onSuccess) {
                onSuccess(response, variables, context);
            }
        },
    });
};
export const useMakePromptProduction = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, onError, onMutate } = options || {};
    const name = useRecoilValue(store.promptsName);
    const pageSize = useRecoilValue(store.promptsPageSize);
    const category = useRecoilValue(store.promptsCategory);
    return useMutation({
        mutationFn: (variables) => dataService.makePromptProduction(variables.id),
        onMutate: (variables) => {
            const groupData = queryClient.getQueryData([
                QueryKeys.promptGroup,
                variables.groupId,
            ]);
            const group = groupData ? structuredClone(groupData) : undefined;
            const listData = queryClient.getQueryData([
                QueryKeys.promptGroups,
                name,
                category,
                pageSize,
            ]);
            const previousListData = listData ? structuredClone(listData) : undefined;
            if (listData) {
                const newData = updateGroupFieldsInPlace(listData, {
                    _id: variables.groupId,
                    productionId: variables.id,
                    productionPrompt: variables.productionPrompt,
                });
                queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], newData);
            }
            if (groupData) {
                queryClient.setQueryData([QueryKeys.promptGroup, variables.groupId], {
                    ...groupData,
                    productionId: variables.id,
                    productionPrompt: variables.productionPrompt,
                });
            }
            if (onMutate) {
                onMutate(variables);
            }
            return { group, previousListData };
        },
        onError: (err, variables, context) => {
            if (context?.group) {
                queryClient.setQueryData([QueryKeys.promptGroup, variables.groupId], context.group);
            }
            if (context?.previousListData) {
                queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], context.previousListData);
            }
            if (onError) {
                onError(err, variables, context);
            }
        },
        onSuccess: (response, variables, context) => {
            updateGroupInAll(queryClient, {
                _id: variables.groupId,
                productionId: variables.id,
                productionPrompt: variables.productionPrompt,
            });
            if (onSuccess) {
                onSuccess(response, variables, context);
            }
        },
    });
};
export const useRecordPromptUsage = () => {
    const queryClient = useQueryClient();
    const name = useRecoilValue(store.promptsName);
    const category = useRecoilValue(store.promptsCategory);
    const pageSize = useRecoilValue(store.promptsPageSize);
    return useMutation({
        mutationFn: (groupId) => dataService.recordPromptGroupUsage(groupId),
        onSuccess: (data, groupId) => {
            const update = { _id: groupId, numberOfGenerations: data.numberOfGenerations };
            queryClient.setQueryData([QueryKeys.promptGroups, name, category, pageSize], (old) => (old ? updateGroupFieldsInPlace(old, update) : old));
            updateGroupInAll(queryClient, update);
        },
    });
};
