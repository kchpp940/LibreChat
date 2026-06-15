import { useResetRecoilState, useSetRecoilState } from 'recoil';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MutationKeys, QueryKeys, dataService, request } from 'librechat-data-provider';
import useClearStates from '~/hooks/Config/useClearStates';
import { clearAllConversationStorage } from '~/utils';
import store from '~/store';
/* login/logout */
export const useLogoutUserMutation = (options) => {
    const queryClient = useQueryClient();
    const clearStates = useClearStates();
    const resetDefaultPreset = useResetRecoilState(store.defaultPreset);
    const setQueriesEnabled = useSetRecoilState(store.queriesEnabled);
    return useMutation([MutationKeys.logoutUser], {
        mutationFn: () => dataService.logout(),
        ...(options || {}),
        onSuccess: (...args) => {
            setQueriesEnabled(false);
            resetDefaultPreset();
            clearStates();
            queryClient.removeQueries();
            options?.onSuccess?.(...args);
        },
    });
};
export const useLoginUserMutation = (options) => {
    const queryClient = useQueryClient();
    const clearStates = useClearStates();
    const resetDefaultPreset = useResetRecoilState(store.defaultPreset);
    const setQueriesEnabled = useSetRecoilState(store.queriesEnabled);
    return useMutation([MutationKeys.loginUser], {
        mutationFn: (payload) => dataService.login(payload),
        ...(options || {}),
        onMutate: (vars) => {
            setQueriesEnabled(false);
            resetDefaultPreset();
            clearStates();
            queryClient.removeQueries();
            options?.onMutate?.(vars);
        },
        // Queries re-enabled in setUserContext (AuthContext) after setTokenHeader runs
        onSuccess: (...args) => {
            options?.onSuccess?.(...args);
        },
        onError: (...args) => {
            setQueriesEnabled(true);
            options?.onError?.(...args);
        },
    });
};
export const useRefreshTokenMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation([MutationKeys.refreshToken], {
        mutationFn: () => request.refreshToken(),
        ...(options || {}),
        onMutate: (vars) => {
            queryClient.removeQueries();
            options?.onMutate?.(vars);
        },
    });
};
/* User */
export const useDeleteUserMutation = (options) => {
    const queryClient = useQueryClient();
    const clearStates = useClearStates();
    const resetDefaultPreset = useResetRecoilState(store.defaultPreset);
    return useMutation([MutationKeys.deleteUser], {
        mutationFn: (payload) => dataService.deleteUser(payload),
        ...(options || {}),
        onSuccess: (...args) => {
            resetDefaultPreset();
            clearStates();
            clearAllConversationStorage();
            queryClient.removeQueries();
            options?.onSuccess?.(...args);
        },
    });
};
export const useEnableTwoFactorMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.enableTwoFactor(payload), {
        onSuccess: (data) => {
            queryClient.setQueryData([QueryKeys.user, '2fa'], data);
        },
    });
};
export const useVerifyTwoFactorMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.verifyTwoFactor(payload), {
        onSuccess: (data) => {
            queryClient.setQueryData([QueryKeys.user, '2fa'], data);
        },
    });
};
export const useConfirmTwoFactorMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.confirmTwoFactor(payload), {
        onSuccess: (data) => {
            queryClient.setQueryData([QueryKeys.user, '2fa'], data);
        },
    });
};
export const useDisableTwoFactorMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.disableTwoFactor(payload), {
        onSuccess: () => {
            queryClient.setQueryData([QueryKeys.user, '2fa'], null);
        },
    });
};
export const useRegenerateBackupCodesMutation = () => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.regenerateBackupCodes(payload), {
        onSuccess: (data) => {
            queryClient.setQueryData([QueryKeys.user, '2fa', 'backup'], data);
        },
    });
};
export const useVerifyTwoFactorTempMutation = (options) => {
    const queryClient = useQueryClient();
    return useMutation((payload) => dataService.verifyTwoFactorTemp(payload), {
        ...(options || {}),
        onSuccess: (data, ...args) => {
            queryClient.setQueryData([QueryKeys.user, '2fa'], data);
            options?.onSuccess?.(data, ...args);
        },
    });
};
