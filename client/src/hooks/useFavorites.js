import { useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { useToastContext } from '@librechat/client';
import { normalizeError, isAppError, ErrorCode } from 'librechat-data-provider';
import { useGetFavoritesQuery, useUpdateFavoritesMutation } from '~/data-provider';
import { favoritesAtom } from '~/store';
import { useLocalize } from '~/hooks';
import { logger } from '~/utils';
/** Maximum number of favorites allowed (must match backend MAX_FAVORITES) */
const MAX_FAVORITES = 50;
/**
 * Hook for managing user favorites (pinned agents, models, and model specs).
 *
 * Favorites are synchronized with the server via `/api/user/settings/favorites`.
 * Each favorite is either:
 * - An agent: `{ agentId: string }`
 * - A model: `{ model: string, endpoint: string }`
 * - A model spec: `{ spec: string }`
 *
 * @returns Object containing favorites state and helper methods for
 * adding, removing, toggling, reordering, and checking favorites.
 */
/**
 * Cleans favorites array to only include canonical shapes (agentId, model+endpoint, or spec).
 */
const cleanFavorites = (favorites) => {
    if (!Array.isArray(favorites)) {
        return [];
    }
    return favorites
        .map((f) => {
        if (f.agentId) {
            return { agentId: f.agentId };
        }
        if (f.model && f.endpoint) {
            return { model: f.model, endpoint: f.endpoint };
        }
        if (f.spec) {
            return { spec: f.spec };
        }
        return null;
    })
        .filter((f) => f !== null);
};
export default function useFavorites() {
    const localize = useLocalize();
    const { showToast } = useToastContext();
    const [favorites, setFavorites] = useAtom(favoritesAtom);
    const getFavoritesQuery = useGetFavoritesQuery();
    const updateFavoritesMutation = useUpdateFavoritesMutation();
    const isMutatingRef = useRef(false);
    useEffect(() => {
        // Skip updating local state if a mutation is in progress or just completed
        // The local state is already optimistically updated by saveFavorites
        if (isMutatingRef.current || updateFavoritesMutation.isLoading) {
            return;
        }
        if (getFavoritesQuery.data) {
            if (Array.isArray(getFavoritesQuery.data)) {
                setFavorites(getFavoritesQuery.data);
            }
            else {
                setFavorites([]);
            }
        }
    }, [getFavoritesQuery.data, setFavorites, updateFavoritesMutation.isLoading]);
    const getFavoriteErrorMessage = useCallback((error) => {
        const appError = normalizeError(error);
        if (appError.code === ErrorCode.MAX_FAVORITES_EXCEEDED) {
            const limit =
                (isAppError(error) && typeof error.details?.limit === 'number'
                    ? error.details.limit
                    : undefined) ??
                (typeof (appError.originalError?.response?.data?.limit) === 'number'
                    ? appError.originalError.response.data.limit
                    : undefined) ??
                MAX_FAVORITES;
            return localize('com_ui_max_favorites_reached', { 0: String(limit) });
        }
        return localize('com_ui_error');
    }, [localize]);
    const saveFavorites = useCallback(async (newFavorites) => {
        const cleaned = cleanFavorites(newFavorites);
        setFavorites(cleaned);
        isMutatingRef.current = true;
        try {
            await updateFavoritesMutation.mutateAsync(cleaned);
        }
        catch (error) {
            logger.error('Error updating favorites:', error);
            showToast({ message: getFavoriteErrorMessage(error), status: 'error' });
            // Refetch to resync state with server
            getFavoritesQuery.refetch();
        }
        finally {
            // Use a small delay to prevent the useEffect from triggering immediately
            // after the mutation completes but before React has finished processing
            setTimeout(() => {
                isMutatingRef.current = false;
            }, 100);
        }
    }, [setFavorites, updateFavoritesMutation, showToast, getFavoriteErrorMessage, getFavoritesQuery]);
    const addFavoriteAgent = (agentId) => {
        if (favorites.some((f) => f.agentId === agentId))
            return;
        const newFavorites = [...favorites, { agentId }];
        saveFavorites(newFavorites);
    };
    const removeFavoriteAgent = (agentId) => {
        const newFavorites = favorites.filter((f) => f.agentId !== agentId);
        saveFavorites(newFavorites);
    };
    const addFavoriteModel = (model) => {
        if (favorites.some((f) => f.model === model.model && f.endpoint === model.endpoint))
            return;
        const newFavorites = [...favorites, { model: model.model, endpoint: model.endpoint }];
        saveFavorites(newFavorites);
    };
    const removeFavoriteModel = (model, endpoint) => {
        const newFavorites = favorites.filter((f) => !(f.model === model && f.endpoint === endpoint));
        saveFavorites(newFavorites);
    };
    const isFavoriteAgent = (agentId) => {
        if (!agentId) {
            return false;
        }
        return favorites.some((f) => f.agentId === agentId);
    };
    const isFavoriteModel = (model, endpoint) => {
        return favorites.some((f) => f.model === model && f.endpoint === endpoint);
    };
    const addFavoriteSpec = (spec) => {
        if (favorites.some((f) => f.spec === spec)) {
            return;
        }
        const newFavorites = [...favorites, { spec }];
        saveFavorites(newFavorites);
    };
    const removeFavoriteSpec = (spec) => {
        const newFavorites = favorites.filter((f) => f.spec !== spec);
        saveFavorites(newFavorites);
    };
    const isFavoriteSpec = (spec) => {
        if (!spec) {
            return false;
        }
        return favorites.some((f) => f.spec === spec);
    };
    const toggleFavoriteSpec = (spec) => {
        if (isFavoriteSpec(spec)) {
            removeFavoriteSpec(spec);
        }
        else {
            addFavoriteSpec(spec);
        }
    };
    const toggleFavoriteAgent = (agentId) => {
        if (isFavoriteAgent(agentId)) {
            removeFavoriteAgent(agentId);
        }
        else {
            addFavoriteAgent(agentId);
        }
    };
    const toggleFavoriteModel = (model) => {
        if (isFavoriteModel(model.model, model.endpoint)) {
            removeFavoriteModel(model.model, model.endpoint);
        }
        else {
            addFavoriteModel(model);
        }
    };
    /**
     * Reorder favorites and optionally persist the new order to the server.
     * This combines state update and persistence to avoid race conditions
     * where the closure captures stale state.
     */
    const reorderFavorites = useCallback(async (newFavorites, persist = false) => {
        const cleaned = cleanFavorites(newFavorites);
        setFavorites(cleaned);
        if (persist) {
            isMutatingRef.current = true;
            try {
                await updateFavoritesMutation.mutateAsync(cleaned);
            }
            catch (error) {
                logger.error('Error reordering favorites:', error);
                showToast({ message: getFavoriteErrorMessage(error), status: 'error' });
                // Refetch to resync state with server
                getFavoritesQuery.refetch();
            }
            finally {
                setTimeout(() => {
                    isMutatingRef.current = false;
                }, 100);
            }
        }
    }, [setFavorites, updateFavoritesMutation, showToast, getFavoriteErrorMessage, getFavoritesQuery]);
    return {
        favorites,
        addFavoriteAgent,
        removeFavoriteAgent,
        addFavoriteModel,
        removeFavoriteModel,
        addFavoriteSpec,
        removeFavoriteSpec,
        isFavoriteAgent,
        isFavoriteModel,
        isFavoriteSpec,
        toggleFavoriteAgent,
        toggleFavoriteModel,
        toggleFavoriteSpec,
        reorderFavorites,
        /** Whether the favorites query is currently loading */
        isLoading: getFavoritesQuery.isLoading,
        /** Whether there was an error fetching favorites */
        isError: getFavoritesQuery.isError,
        /** Whether the update mutation is in progress */
        isUpdating: updateFavoritesMutation.isLoading,
        /** Error from fetching favorites, if any */
        fetchError: getFavoritesQuery.error,
        /** Error from updating favorites, if any */
        updateError: updateFavoritesMutation.error,
    };
}
