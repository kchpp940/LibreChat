import { useAuthContext } from '~/hooks/AuthContext';
import { useGraphTokenQuery, useGetStartupConfig } from '~/data-provider';
export default function useSharePointToken({ enabled = true, purpose, }) {
    const { user } = useAuthContext();
    const { data: startupConfig } = useGetStartupConfig();
    const sharePointBaseUrl = startupConfig?.sharePointBaseUrl;
    const sharePointPickerGraphScope = startupConfig?.sharePointPickerGraphScope;
    const sharePointPickerSharePointScope = startupConfig?.sharePointPickerSharePointScope;
    const isEntraIdUser = user?.provider === 'openid';
    const graphScopes = purpose === 'Pick' ? sharePointPickerSharePointScope : sharePointPickerGraphScope;
    const { data: token, isLoading, error, refetch, } = useGraphTokenQuery({
        scopes: graphScopes,
        enabled: enabled && isEntraIdUser && !!sharePointBaseUrl,
    });
    return {
        token,
        isLoading,
        error,
        refetch,
    };
}
