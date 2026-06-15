import { dataService, QueryKeys } from 'librechat-data-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
export const useGetFavoritesQuery = (config) => {
    return useQuery([QueryKeys.favorites], () => dataService.getFavorites(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
export const useUpdateFavoritesMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((favorites) => dataService.updateFavorites(favorites), {
        // Optimistic update to prevent UI flickering when toggling favorites
        onMutate: async (newFavorites) => {
            await queryClient.cancelQueries([QueryKeys.favorites]);
            const previousFavorites = queryClient.getQueryData([QueryKeys.favorites]);
            queryClient.setQueryData([QueryKeys.favorites], newFavorites);
            return { previousFavorites };
        },
        onError: (_err, _newFavorites, context) => {
            if (context?.previousFavorites) {
                queryClient.setQueryData([QueryKeys.favorites], context.previousFavorites);
            }
        },
    });
};
export const useGetSkillFavoritesQuery = (config) => {
    return useQuery([QueryKeys.skillFavorites], () => dataService.getSkillFavorites(), {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        ...config,
    });
};
export const useUpdateSkillFavoritesMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((skillFavorites) => dataService.updateSkillFavorites(skillFavorites), {
        onMutate: async (newFavorites) => {
            await queryClient.cancelQueries([QueryKeys.skillFavorites]);
            const previous = queryClient.getQueryData([QueryKeys.skillFavorites]);
            queryClient.setQueryData([QueryKeys.skillFavorites], newFavorites);
            return { previous };
        },
        onError: (_err, _newFavorites, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData([QueryKeys.skillFavorites], context.previous);
            }
        },
    });
};
