import { useMemo } from 'react';
import { EModelEndpoint } from 'librechat-data-provider';
import { useGetEndpointsQuery } from '~/data-provider';
export default function useGetAgentsConfig(options) {
    const { endpointsConfig: providedConfig } = options || {};
    const { data: queriedConfig } = useGetEndpointsQuery({
        enabled: !providedConfig,
    });
    const endpointsConfig = providedConfig || queriedConfig;
    const agentsConfig = useMemo(() => {
        const config = endpointsConfig?.[EModelEndpoint.agents] ?? null;
        if (!config)
            return null;
        return {
            ...config,
            capabilities: Array.isArray(config.capabilities)
                ? config.capabilities.map((cap) => cap)
                : [],
        };
    }, [endpointsConfig]);
    return { agentsConfig, endpointsConfig };
}
