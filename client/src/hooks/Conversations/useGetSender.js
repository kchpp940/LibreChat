import { useCallback } from 'react';
import { getResponseSender } from 'librechat-data-provider';
import { useGetEndpointsQuery } from '~/data-provider';
export default function useGetSender() {
    const { data: endpointsConfig = {} } = useGetEndpointsQuery();
    return useCallback((endpointOption) => {
        const { modelDisplayLabel } = endpointsConfig?.[endpointOption.endpoint ?? ''] ?? {};
        return getResponseSender({ ...endpointOption, modelDisplayLabel });
    }, [endpointsConfig]);
}
