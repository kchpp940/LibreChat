import { Constants, defaultAssistantsVersion, } from 'librechat-data-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, MutationKeys, QueryKeys, defaultOrderQuery } from 'librechat-data-provider';
import { logger } from '~/utils';
import { conversationCacheService } from './Conversations';
import useUpdateTagsInConvo from '~/hooks/Conversations/useUpdateTagsInConvo';
import { updateConversationTag } from '~/utils/conversationTags';
import { useConversationTagsQuery } from './queries';
export const useUpdateConversationMutation = (id) => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.updateConversation(payload), {
        onSuccess: (updatedConvo, payload) => {
            const targetId = payload.conversationId || id;
            conversationCacheService.setConversation(queryClient, targetId, updatedConvo);
            conversationCacheService.updateConversation(queryClient, targetId, () => updatedConvo);
            conversationCacheService.invalidateProjectConversations(queryClient);
        },
    });
};
export const useTagConversationMutation = (conversationId, options) => {
    const query = useConversationTagsQuery();
    const { updateTagsInConversation } = useUpdateTagsInConvo();
    return useMutation((payload) => dataService.addTagToConversation(conversationId, payload), {
        onSuccess: (updatedTags, ...rest) => {
            query.refetch();
            updateTagsInConversation(conversationId, updatedTags);
            options?.onSuccess?.(updatedTags, ...rest);
        },
        onError: options?.onError,
        onMutate: options?.onMutate,
    });
};
export const useArchiveConvoMutation = (options) => {
    const queryClient = useQueryClient();
    const { onMutate, onError, onSuccess, ..._options } = options || {};
    return useMutation((payload) => dataService.archiveConversation(payload), {
        onMutate,
        onSuccess: (_data, vars, context) => {
            const isArchived = vars.isArchived === true;
            conversationCacheService.archiveConversation(queryClient, vars.conversationId, isArchived, _data);
            if (_data.chatProjectId) {
                queryClient.invalidateQueries([QueryKeys.project, _data.chatProjectId]);
            }
            onSuccess?.(_data, vars, context);
        },
        onError,
        onSettled: () => {
            conversationCacheService.invalidateAllConversationLists(queryClient);
            queryClient.invalidateQueries([QueryKeys.projects]);
        },
        ..._options,
    });
};
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
// Add a tag or update tag information (tag, description, position, etc.)
export const useConversationTagMutation = ({ context, tag, options, }) => {
    const queryClient = useQueryClient();
    const { onSuccess, ..._options } = options || {};
    const onMutationSuccess = (_data, vars) => {
        conversationCacheService.setConversationTags(queryClient, (queryData) => {
            if (!queryData) {
                return [
                    {
                        count: 1,
                        position: 0,
                        tag: Constants.SAVED_TAG,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                ];
            }
            if (tag === undefined || !tag.length) {
                // Check if the tag already exists
                const existingTagIndex = queryData.findIndex((item) => item.tag === _data.tag);
                if (existingTagIndex !== -1) {
                    logger.log('tag_mutation', `"Created" tag exists, updating from ${context}`, queryData, _data);
                    // If the tag exists, update it
                    const updatedData = [...queryData];
                    updatedData[existingTagIndex] = { ...updatedData[existingTagIndex], ..._data };
                    return updatedData.sort((a, b) => a.position - b.position);
                }
                else {
                    // If the tag doesn't exist, add it
                    logger.log('tag_mutation', `"Created" tag is new, adding from ${context}`, queryData, _data);
                    return [...queryData, _data].sort((a, b) => a.position - b.position);
                }
            }
            logger.log('tag_mutation', `Updating tag from ${context}`, queryData, _data);
            return updateConversationTag(queryData, vars, _data, tag);
        });
        if (vars.addToConversation === true && vars.conversationId != null && _data.tag) {
            const currentConvo = conversationCacheService.getConversation(
                queryClient,
                vars.conversationId,
            );
            if (!currentConvo) {
                return;
            }
            logger.log('tag_mutation', `\`updateTagsInConversation\` Update from ${context}`, currentConvo);
            updateTagsInConversation(vars.conversationId, [...(currentConvo.tags || []), _data.tag]);
        }
        // Change the tag title to the new title
        if (tag != null) {
            replaceTagsInAllConversations(tag, _data.tag);
        }
    };
    const { updateTagsInConversation, replaceTagsInAllConversations } = useUpdateTagsInConvo();
    return useMutation((payload) => tag != null
        ? dataService.updateConversationTag(tag, payload)
        : dataService.createConversationTag(payload), {
        onSuccess: (...args) => {
            onMutationSuccess(...args);
            onSuccess?.(...args);
        },
        ..._options,
    });
};
// When a bookmark is deleted, remove that bookmark(tag) from all conversations associated with it
export const useDeleteTagInConversations = () => {
    const queryClient = useQueryClient();
    const deleteTagInAllConversation = (deletedTag) => {
        conversationCacheService.removeTagFromAllConversations(queryClient, deletedTag);
    };
    return deleteTagInAllConversation;
};
export const useDeleteConversationTagMutation = (options) => {
    const queryClient = useQueryClient();
    const deleteTagInAllConversations = useDeleteTagInConversations();
    const { onSuccess, ..._options } = options || {};
    return useMutation((tag) => dataService.deleteConversationTag(tag), {
        onSuccess: (_data, tagToDelete, context) => {
            conversationCacheService.deleteConversationTag(queryClient, tagToDelete);
            deleteTagInAllConversations(tagToDelete);
            onSuccess?.(_data, tagToDelete, context);
        },
        ..._options,
    });
};
export const useDeleteConversationMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.deleteConversation(payload), {
        onMutate: async () => {
            await conversationCacheService.cancelAllConversationQueries(queryClient);
        },
        onError: () => {
        },
        onSuccess: (data, vars, context) => {
            const deletedConversation = vars.conversationId
                ? conversationCacheService.getConversation(queryClient, vars.conversationId)
                : undefined;
            let deletedProjectId = deletedConversation?.chatProjectId;
            if (!deletedProjectId && vars.conversationId) {
                const found = conversationCacheService.findConversation(queryClient, vars.conversationId);
                if (found?.chatProjectId) {
                    deletedProjectId = found.chatProjectId;
                }
            }
            if (vars.conversationId) {
                conversationCacheService.removeConversationFromAllQueries(queryClient, vars.conversationId);
            }
            conversationCacheService.removeConversationFromAllQueries(queryClient, vars.conversationId, 'archived');
            conversationCacheService.removeConversation(queryClient, vars.conversationId);
            conversationCacheService.invalidateConversations(queryClient);
            conversationCacheService.invalidateConversations(queryClient, 'archived');
            conversationCacheService.invalidateProjectConversations(queryClient);
            queryClient.invalidateQueries([QueryKeys.projects]);
            if (deletedProjectId) {
                queryClient.invalidateQueries([QueryKeys.project, deletedProjectId]);
            }
            options?.onSuccess?.(data, vars, context);
        },
    });
};
export const useDuplicateConversationMutation = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ..._options } = options ?? {};
    return useMutation((payload) => dataService.duplicateConversation(payload), {
        onSuccess: (data, vars, context) => {
            const duplicatedConversation = data.conversation;
            if (!duplicatedConversation?.conversationId) {
                return;
            }
            conversationCacheService.setConversation(queryClient, duplicatedConversation.conversationId, duplicatedConversation);
            conversationCacheService.addConversation(queryClient, duplicatedConversation);
            queryClient.setQueryData([QueryKeys.messages, duplicatedConversation.conversationId], data.messages);
            conversationCacheService.invalidateConversations(queryClient, 'all');
            conversationCacheService.invalidateProjectConversations(queryClient);
            queryClient.invalidateQueries([QueryKeys.projects]);
            if (duplicatedConversation.chatProjectId) {
                queryClient.invalidateQueries([QueryKeys.project, duplicatedConversation.chatProjectId]);
            }
            if (duplicatedConversation.tags && duplicatedConversation.tags.length > 0) {
                conversationCacheService.incrementTagCounts(queryClient, duplicatedConversation.tags);
            }
            onSuccess?.(data, vars, context);
        },
        ..._options,
    });
};
export const useForkConvoMutation = (options) => {
    const queryClient = useQueryClient();
    const { onSuccess, ..._options } = options || {};
    return useMutation((payload) => dataService.forkConversation(payload), {
        onSuccess: (data, vars, context) => {
            if (!vars.conversationId) {
                return;
            }
            const forkedConversation = data.conversation;
            const forkedConversationId = forkedConversation.conversationId;
            if (!forkedConversationId) {
                return;
            }
            conversationCacheService.setConversation(queryClient, forkedConversationId, forkedConversation);
            conversationCacheService.addConversation(queryClient, forkedConversation);
            queryClient.setQueryData([QueryKeys.messages, forkedConversationId], data.messages);
            conversationCacheService.invalidateConversations(queryClient, 'all');
            conversationCacheService.invalidateProjectConversations(queryClient);
            queryClient.invalidateQueries([QueryKeys.projects]);
            if (forkedConversation.chatProjectId) {
                queryClient.invalidateQueries([QueryKeys.project, forkedConversation.chatProjectId]);
            }
            if (forkedConversation.tags && forkedConversation.tags.length > 0) {
                conversationCacheService.incrementTagCounts(queryClient, forkedConversation.tags);
            }
            onSuccess?.(data, vars, context);
        },
        ..._options,
    });
};
export const useUploadConversationsMutation = (_options) => {
    const queryClient = useQueryClient();
    const { onSuccess, onError, onMutate } = _options || {};
    return useMutation({
        mutationFn: (formData) => dataService.importConversationsFile(formData),
        onSuccess: (data, variables, context) => {
            /* TODO: optimize to return imported conversations and add manually */
            conversationCacheService.invalidateConversations(queryClient, 'all');
            if (onSuccess) {
                onSuccess(data, variables, context);
            }
        },
        onError: (err, variables, context) => {
            if (onError) {
                onError(err, variables, context);
            }
        },
        onMutate,
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
