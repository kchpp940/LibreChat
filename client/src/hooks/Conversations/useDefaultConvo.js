import { useCallback } from 'react';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import { excludedKeys, getDefaultParamsEndpoint } from 'librechat-data-provider';
import { getDefaultEndpoint, buildDefaultConvo } from '~/utils';
import { useGetEndpointsQuery } from '~/data-provider';
const exceptions = new Set(['spec', 'iconURL']);
const useDefaultConvo = () => {
    const { data: endpointsConfig = {} } = useGetEndpointsQuery();
    const { data: modelsConfig = {} } = useGetModelsQuery();
    const getDefaultConversation = useCallback(({ conversation: _convo, preset, cleanInput, cleanOutput }) => {
        const endpoint = getDefaultEndpoint({
            convoSetup: preset,
            endpointsConfig,
        });
        const models = modelsConfig[endpoint ?? ''] || [];
        const conversation = { ..._convo };
        if (cleanInput === true) {
            for (const key in conversation) {
                if (excludedKeys.has(key) && !exceptions.has(key)) {
                    continue;
                }
                if (conversation[key] == null) {
                    continue;
                }
                conversation[key] = undefined;
            }
        }
        const defaultParamsEndpoint = getDefaultParamsEndpoint(endpointsConfig, endpoint);
        const defaultConvo = buildDefaultConvo({
            conversation: conversation,
            endpoint,
            lastConversationSetup: preset,
            models,
            defaultParamsEndpoint,
        });
        if (!cleanOutput) {
            return defaultConvo;
        }
        for (const key in defaultConvo) {
            if (excludedKeys.has(key) && !exceptions.has(key)) {
                continue;
            }
            if (defaultConvo[key] == null) {
                continue;
            }
            defaultConvo[key] = undefined;
        }
        return defaultConvo;
    }, [endpointsConfig, modelsConfig]);
    return getDefaultConversation;
};
export default useDefaultConvo;
