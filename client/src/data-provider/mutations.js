import { defaultAssistantsVersion, } from 'librechat-data-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, MutationKeys, QueryKeys, defaultOrderQuery } from 'librechat-data-provider';
export {
    useUpdateConversationMutation,
    useTagConversationMutation,
    useArchiveConvoMutation,
    useDeleteConversationMutation,
    useDuplicateConversationMutation,
    useForkConvoMutation,
    useUploadConversationsMutation,
    useConversationTagMutation,
    useDeleteConversationTagMutation,
    useConversationCache,
    convoQueryKeys,
} from './Conversations';
export const useCreateSharedLinkMutation = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ..._options } = options || {};
    return useMutation(({ conversationId, targetMessageId }) => {
        if (!conversationId) {
            throw new Error('Conversation ID is required');
        }
        return dataService.createSharedLink(conversationId, targetMessageId);
    }, {
        onSuccess: (_data, vars, context) => {
            queryClient.setQueryData([QueryKeys.sharedLinks, _data.conversationId], _data);
            onSuccess?.(_data, vars, context);
        },
        ..._options,
    });
};
export const useUpdateSharedLinkMutation = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ..._options } = options || {};
    return useMutation(({ shareId, targetMessageId }) => {
        if (!shareId) {
            throw new Error('Share ID is required');
        }
        return dataService.updateSharedLink(shareId, targetMessageId);
    }, {
        onSuccess: (_data, vars, context) => {
            queryClient.setQueryData([QueryKeys.sharedLinks, _data.conversationId], _data);
            onSuccess?.(_data, vars, context);
        },
        ..._options,
    });
};
export const useDeleteSharedLinkMutation = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess } = options || {};
    return useMutation((vars) => dataService.deleteSharedLink(vars.shareId), {
        onMutate: async (vars) => {
            await queryClient.cancelQueries({
                queryKey: [QueryKeys.sharedLinks],
                exact: false,
            });
            const previousQueries = new Map();
            const queryKeys = queryClient.getQueryCache().findAll([QueryKeys.sharedLinks]);
            queryKeys.forEach((query) => {
                const previousData = queryClient.getQueryData(query.queryKey);
                previousQueries.set(query.queryKey, previousData);
                queryClient.setQueryData(query.queryKey, (old) => {
                    if (!old?.pages) {
                        return old;
                    }
                    const updatedPages = old.pages.map((page) => ({
                        ...page,
                        links: page.links.filter((link) => link.shareId !== vars.shareId),
                    }));
                    const nonEmptyPages = updatedPages.filter((page) => page.links.length > 0);
                    return {
                        ...old,
                        pages: nonEmptyPages,
                    };
                });
            });
            return { previousQueries };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach((prevData, prevQueryKey) => {
                    queryClient.setQueryData(prevQueryKey, prevData);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: [QueryKeys.sharedLinks],
                exact: false,
            });
        },
        onSuccess: (data, variables) => {
            if (onSuccess) {
                onSuccess(data, variables);
            }
            queryClient.refetchQueries({
                queryKey: [QueryKeys.sharedLinks],
                exact: true,
            });
        },
    });
};
export const useUpdatePresetMutation = (options) => {
    return useMutation([MutationKeys.updatePreset], {
        mutationFn: (preset) => dataService.updatePreset(preset),
        ...(options || {}),
    });
};
export const useDeletePresetMutation = (options) => {
    return useMutation([MutationKeys.deletePreset], {
        mutationFn: (preset) => dataService.deletePreset(preset),
        ...(options || {}),
    });
};
/* Avatar upload */
export const useUploadAvatarMutation = (options) => {
    return useMutation([MutationKeys.avatarUpload], {
        mutationFn: (variables) => dataService.uploadAvatar(variables),
        ...(options || {}),
    });
};
/* Speech to text */
export const useSpeechToTextMutation = (options) => {
    return useMutation([MutationKeys.speechToText], {
        mutationFn: (variables) => dataService.speechToText(variables),
        ...(options || {}),
    });
};
/* Text to speech */
export const useTextToSpeechMutation = (options) => {
    return useMutation([MutationKeys.textToSpeech], {
        mutationFn: (variables) => dataService.textToSpeech(variables),
        ...(options || {}),
    });
};
/**
 * ASSISTANTS
 */
/**
 * Create a new assistant
 */
export const useCreateAssistantMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation((newAssistantData) => dataService.createAssistant(newAssistantData), {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (newAssistant, variables, context) => {
            const listRes = queryClient.getQueryData([
                QueryKeys.assistants,
                variables.endpoint,
                defaultOrderQuery,
            ]);
            if (!listRes) {
                return options?.onSuccess?.(newAssistant, variables, context);
            }
            const currentAssistants = [newAssistant, ...JSON.parse(JSON.stringify(listRes.data))];
            queryClient.setQueryData([QueryKeys.assistants, variables.endpoint, defaultOrderQuery], {
                ...listRes,
                data: currentAssistants,
            });
            return options?.onSuccess?.(newAssistant, variables, context);
        },
    });
};
/**
 * Hook for updating an assistant
 */
export const useUpdateAssistantMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ assistant_id, data }) => {
        const { endpoint } = data;
        const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
        const endpointConfig = endpointsConfig?.[endpoint];
        const version = endpointConfig?.version ?? defaultAssistantsVersion[endpoint];
        return dataService.updateAssistant({
            data,
            version,
            assistant_id,
        });
    }, {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (updatedAssistant, variables, context) => {
            const listRes = queryClient.getQueryData([
                QueryKeys.assistants,
                variables.data.endpoint,
                defaultOrderQuery,
            ]);
            if (!listRes) {
                return options?.onSuccess?.(updatedAssistant, variables, context);
            }
            queryClient.setQueryData([QueryKeys.assistantDocs, variables.data.endpoint], (prev) => {
                if (!prev) {
                    return prev;
                }
                return prev.map((doc) => {
                    if (doc.assistant_id === variables.assistant_id) {
                        return {
                            ...doc,
                            conversation_starters: updatedAssistant.conversation_starters,
                            append_current_datetime: variables.data.append_current_datetime,
                        };
                    }
                    return doc;
                });
            });
            queryClient.setQueryData([QueryKeys.assistants, variables.data.endpoint, defaultOrderQuery], {
                ...listRes,
                data: listRes.data.map((assistant) => {
                    if (assistant.id === variables.assistant_id) {
                        return updatedAssistant;
                    }
                    return assistant;
                }),
            });
            return options?.onSuccess?.(updatedAssistant, variables, context);
        },
    });
};
/**
 * Hook for deleting an assistant
 */
export const useDeleteAssistantMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(({ assistant_id, model, endpoint }) => {
        const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
        const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
        return dataService.deleteAssistant({ assistant_id, model, version, endpoint });
    }, {
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (_data, variables, context) => {
            const listRes = queryClient.getQueryData([
                QueryKeys.assistants,
                variables.endpoint,
                defaultOrderQuery,
            ]);
            if (!listRes) {
                return options?.onSuccess?.(_data, variables, context);
            }
            const data = listRes.data.filter((assistant) => assistant.id !== variables.assistant_id);
            queryClient.setQueryData([QueryKeys.assistants, variables.endpoint, defaultOrderQuery], {
                ...listRes,
                data,
            });
            return options?.onSuccess?.(_data, variables, data);
        },
    });
};
/**
 * Hook for uploading an assistant avatar
 */
export const useUploadAssistantAvatarMutation = (options) => {
    return useMutation([MutationKeys.assistantAvatarUpload], {
        mutationFn: ({ postCreation: _postCreation, ...variables }) => dataService.uploadAssistantAvatar(variables),
        ...(options || {}),
    });
};
/**
 * Hook for updating Assistant Actions
 */
export const useUpdateAction = (options) => {
    const queryClient = useQueryClient();
    return useMutation([MutationKeys.updateAction], {
        mutationFn: (variables) => dataService.updateAction(variables),
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (updateActionResponse, variables, context) => {
            const listRes = queryClient.getQueryData([
                QueryKeys.assistants,
                variables.endpoint,
                defaultOrderQuery,
            ]);
            if (!listRes) {
                return options?.onSuccess?.(updateActionResponse, variables, context);
            }
            const updatedAssistant = updateActionResponse[1];
            queryClient.setQueryData([QueryKeys.assistants, variables.endpoint, defaultOrderQuery], {
                ...listRes,
                data: listRes.data.map((assistant) => {
                    if (assistant.id === variables.assistant_id) {
                        return updatedAssistant;
                    }
                    return assistant;
                }),
            });
            queryClient.setQueryData([QueryKeys.actions], (prev) => {
                return prev
                    ?.map((action) => {
                    if (action.action_id === variables.action_id) {
                        return updateActionResponse[2];
                    }
                    return action;
                })
                    .concat(variables.action_id != null && variables.action_id ? [] : [updateActionResponse[2]]);
            });
            return options?.onSuccess?.(updateActionResponse, variables, context);
        },
    });
};
/**
 * Hook for deleting an Assistant Action
 */
export const useDeleteAction = (options) => {
    const queryClient = useQueryClient();
    return useMutation([MutationKeys.deleteAction], {
        mutationFn: (variables) => {
            const { endpoint } = variables;
            const endpointsConfig = queryClient.getQueryData([QueryKeys.endpoints]);
            const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
            return dataService.deleteAction({
                ...variables,
                version,
            });
        },
        onMutate: (variables) => options?.onMutate?.(variables),
        onError: (error, variables, context) => options?.onError?.(error, variables, context),
        onSuccess: (_data, variables, context) => {
            let domain = '';
            queryClient.setQueryData([QueryKeys.actions], (prev) => {
                return prev?.filter((action) => {
                    domain = action.metadata.domain;
                    return action.action_id !== variables.action_id;
                });
            });
            queryClient.setQueryData([QueryKeys.assistants, variables.endpoint, defaultOrderQuery], (prev) => {
                if (!prev) {
                    return prev;
                }
                return {
                    ...prev,
                    data: prev.data.map((assistant) => {
                        if (assistant.id === variables.assistant_id) {
                            return {
                                ...assistant,
                                tools: (assistant.tools ?? []).filter((tool) => !(tool.function?.name.includes(domain ?? '') ?? false)),
                            };
                        }
                        return assistant;
                    }),
                };
            });
            return options?.onSuccess?.(_data, variables, context);
        },
    });
};
/**
 * Hook for verifying email address
 */
export const useVerifyEmailMutation = (options) => {
    return useMutation({
        mutationFn: (variables) => dataService.verifyEmail(variables),
        ...(options || {}),
    });
};
/**
 * Hook for resending verficiation email
 */
export const useResendVerificationEmail = (options) => {
    return useMutation({
        mutationFn: (variables) => dataService.resendVerificationEmail(variables),
        ...(options || {}),
    });
};
export const useAcceptTermsMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation(() => dataService.acceptTerms(), {
        onSuccess: (data, variables, context) => {
            queryClient.setQueryData([QueryKeys.userTerms], {
                termsAccepted: true,
            });
            options?.onSuccess?.(data, variables, context);
        },
        onError: options?.onError,
        onMutate: options?.onMutate,
    });
};
