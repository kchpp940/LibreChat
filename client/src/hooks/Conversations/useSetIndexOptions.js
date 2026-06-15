import { EModelEndpoint, tConvoUpdateSchema, } from 'librechat-data-provider';
import usePresetIndexOptions from './usePresetIndexOptions';
import { useChatContext } from '~/Providers/ChatContext';
const useSetIndexOptions = (preset = false) => {
    const { conversation, setConversation } = useChatContext();
    const result = usePresetIndexOptions(preset);
    if (result && typeof result !== 'boolean') {
        return result;
    }
    const setOption = (param) => (newValue) => {
        const update = {};
        update[param] = newValue;
        if (param === 'presetOverride') {
            const currentOverride = conversation?.presetOverride || {};
            update['presetOverride'] = {
                ...currentOverride,
                ...newValue,
            };
        }
        // Auto-enable Responses API when web search is enabled (only for OpenAI/Azure/Custom endpoints)
        if (param === 'web_search' && newValue === true) {
            const currentEndpoint = conversation?.endpoint;
            const isOpenAICompatible = currentEndpoint === EModelEndpoint.openAI ||
                currentEndpoint === EModelEndpoint.azureOpenAI ||
                currentEndpoint === EModelEndpoint.custom;
            if (isOpenAICompatible) {
                const currentUseResponsesApi = conversation?.useResponsesApi ?? false;
                if (!currentUseResponsesApi) {
                    update['useResponsesApi'] = true;
                }
            }
        }
        setConversation((prevState) => tConvoUpdateSchema.parse({
            ...prevState,
            ...update,
        }));
    };
    const setExample = (i, type, newValue = null) => {
        const update = {};
        const current = conversation?.examples?.slice() || [];
        const currentExample = { ...current[i] };
        currentExample[type] = { content: newValue };
        current[i] = currentExample;
        update['examples'] = current;
        setConversation((prevState) => tConvoUpdateSchema.parse({
            ...prevState,
            ...update,
        }));
    };
    const addExample = () => {
        const update = {};
        const current = conversation?.examples?.slice() || [];
        current.push({ input: { content: '' }, output: { content: '' } });
        update['examples'] = current;
        setConversation((prevState) => tConvoUpdateSchema.parse({
            ...prevState,
            ...update,
        }));
    };
    const removeExample = () => {
        const update = {};
        const current = conversation?.examples?.slice() || [];
        if (current.length <= 1) {
            update['examples'] = [{ input: { content: '' }, output: { content: '' } }];
            setConversation((prevState) => tConvoUpdateSchema.parse({
                ...prevState,
                ...update,
            }));
            return;
        }
        current.pop();
        update['examples'] = current;
        setConversation((prevState) => tConvoUpdateSchema.parse({
            ...prevState,
            ...update,
        }));
    };
    return {
        setOption,
        setExample,
        addExample,
        removeExample,
    };
};
export default useSetIndexOptions;
