import { useWatch } from 'react-hook-form';
import { EModelEndpoint, mergeFileConfig, resolveEndpointType, getEndpointFileConfig, } from 'librechat-data-provider';
import { useGetFileConfig, useGetEndpointsQuery } from '~/data-provider';
export default function useAgentFileConfig() {
    const providerOption = useWatch({ name: 'provider' });
    const { data: endpointsConfig } = useGetEndpointsQuery();
    const { data: fileConfig = null } = useGetFileConfig({
        select: (data) => mergeFileConfig(data),
    });
    const providerValue = typeof providerOption === 'string'
        ? providerOption
        : providerOption?.value;
    const endpointType = resolveEndpointType(endpointsConfig, EModelEndpoint.agents, providerValue);
    const endpointFileConfig = getEndpointFileConfig({
        fileConfig,
        endpointType,
        endpoint: providerValue || EModelEndpoint.agents,
    });
    return { endpointType, providerValue, endpointFileConfig };
}
