import { atom, selector } from 'recoil';
import { EModelEndpoint } from 'librechat-data-provider';
const defaultConfig = {
    [EModelEndpoint.azureOpenAI]: null,
    [EModelEndpoint.azureAssistants]: null,
    [EModelEndpoint.assistants]: null,
    [EModelEndpoint.agents]: null,
    [EModelEndpoint.openAI]: null,
    [EModelEndpoint.google]: null,
    [EModelEndpoint.anthropic]: null,
    [EModelEndpoint.custom]: null,
};
const endpointsConfig = atom({
    key: 'endpointsConfig',
    default: defaultConfig,
});
const endpointsQueryEnabled = atom({
    key: 'endpointsQueryEnabled',
    default: true,
});
const endpointsFilter = selector({
    key: 'endpointsFilter',
    get: ({ get }) => {
        const config = get(endpointsConfig) || {};
        const filter = {};
        for (const key of Object.keys(config)) {
            filter[key] = !!config[key];
        }
        return filter;
    },
});
export default {
    endpointsConfig,
    endpointsFilter,
    defaultConfig,
    endpointsQueryEnabled,
};
