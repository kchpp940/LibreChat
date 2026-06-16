import { useRecoilCallback } from 'recoil';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { conversationCacheService } from '../Conversations/cacheService';
import store from '~/store';
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
            // Invalidate so an *active* project-detail observer refetches and settles into a
            // not-found state — consumers (e.g. ChatRoute) can then react to the deletion.
            // (Removing it instead leaves observers stuck loading under `refetchOnMount: false`.)
            queryClient.invalidateQueries([QueryKeys.project, projectId]);
            // Drop any *inactive* cached detail so a later visit to the deleted project
            // refetches (→ not-found) rather than rendering stale cache within `cacheTime`.
            queryClient.removeQueries([QueryKeys.project, projectId], { type: 'inactive' });
            queryClient.invalidateQueries([QueryKeys.projects]);
            conversationCacheService.invalidateConversations(queryClient, 'all');
        },
    });
};
export const useAssignConversationToProjectMutation = () => {
    const queryClient = useQueryClient();
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
        onSuccess: (result) => {
            updateActiveConversation(result.conversation);
            conversationCacheService.setConversation(queryClient, result.conversation.conversationId, result.conversation);
            [result.previousProjectId, result.projectId].forEach((projectId) => {
                if (projectId) {
                    queryClient.invalidateQueries([QueryKeys.project, projectId]);
                }
            });
            queryClient.invalidateQueries([QueryKeys.projects]);
            conversationCacheService.invalidateConversations(queryClient, 'all');
            conversationCacheService.invalidateProjectConversations(queryClient);
        },
    });
};
