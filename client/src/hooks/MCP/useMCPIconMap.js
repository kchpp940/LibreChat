import { useMemo } from 'react';
import { useMCPServersQuery } from '~/data-provider';
export function useMCPIconMap() {
    const { data: servers } = useMCPServersQuery();
    return useMemo(() => {
        const map = new Map();
        if (!servers) {
            return map;
        }
        for (const [serverName, config] of Object.entries(servers)) {
            if (config.iconPath) {
                map.set(serverName, config.iconPath);
            }
        }
        return map;
    }, [servers]);
}
