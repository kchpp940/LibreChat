import { useMCPConnectionStatusQuery } from '~/data-provider/Tools/queries';
export function useMCPConnectionStatus({ enabled } = {}) {
    const { data } = useMCPConnectionStatusQuery({
        enabled,
    });
    return {
        connectionStatus: data?.connectionStatus,
    };
}
