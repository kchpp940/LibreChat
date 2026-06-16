import { useRecoilCallback } from 'recoil';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import store from '~/store';
import { useConversationCache } from '../Conversations';
export const useCreateProjectMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.createProject(payload), {
        onSuccess: () => {
            queryClient.invalidateQueries([QueryKeys.projects]);
        },
    });
};
export const useUpdateProjectMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.updateProject(payload), {
        onSuccess: (project) => {
            queryClient.setQueryData([QueryKeys.project, project._id], project);
            queryClient.invalidateQueries([QueryKeys.projects]);
        },
    });
};
export const useDeleteProjectMutation = () => {
    const queryClient = useQueryClient();
    const cache = useConversationCache();
    const clearActiveConversationProject = useRecoilCallback(({ snapshot, set }) => async (projectId) => {
        const conversation = await snapshot.getPromise(store.conversationByIndex(0));
        if (conversation?.conversationId && conversation.chatProjectId === projectId) {
            set(store.updateConversationSelector(conversation.conversationId), {
                ...conversation,
                chatProjectId: null,
            });
        }
    }, []);
    return useMutation((projectId) => dataService.deleteProject(projectId), {
        onSuccess: (_result, projectId) => {
            clearActiveConversationProject(projectId);
            queryClient.invalidateQueries([QueryKeys.project, projectId]);
            queryClient.removeQueries([QueryKeys.project, projectId], { type: 'inactive' });
            queryClient.invalidateQueries([QueryKeys.projects]);
            cache.invalidateLists({ refetchFirstPageOnly: false });
        },
    });
};
export const useAssignConversationToProjectMutation = () => {
    const queryClient = useQueryClient();
    const cache = useConversationCache();
    const updateActiveConversation = useRecoilCallback(({ set }) => (conversation) => {
        if (!conversation.conversationId) {
            return;
        }
        set(store.updateConversationSelector(conversation.conversationId), {
            ...conversation,
            chatProjectId: conversation.chatProjectId ?? null,
        });
    }, []);
    return useMutation((payload) => dataService.assignConversationToProject(payload), {
        onMutate: async (payload) => {
            const context = await cache.optimisticUpdate(payload.conversationId, (c) => {
                c.updateConversation(payload.conversationId, (convo) => ({ ...convo, chatProjectId: payload.projectId }), { moveToTop: true });
            });
            return context;
        },
        onError: (_err, _vars, context) => {
            if (context?.rollback) {
                context.rollback();
            }
        },
        onSuccess: (result) => {
            updateActiveConversation(result.conversation);
            if (result.conversation.conversationId) {
                cache.updateConversation(result.conversation.conversationId, () => result.conversation, { moveToTop: true });
            }
            [result.previousProjectId, result.projectId].forEach((projectId) => {
                if (projectId) {
                    cache.invalidateProject(projectId);
                }
            });
            queryClient.invalidateQueries([QueryKeys.projects]);
            cache.invalidateLists({ refetchFirstPageOnly: true, includeProjects: true });
        },
    });
};
