import { useChatContext } from '~/Providers/ChatContext';
import { cleanupPreset } from '~/utils';
const usePresetIndexOptions = (_preset) => {
    const { preset, setPreset } = useChatContext();
    if (!_preset) {
        return false;
    }
    const getConversation = () => preset;
    const setOptions = (options) => {
        const update = { ...options };
        setPreset((prevState) => cleanupPreset({
            preset: {
                ...prevState,
                ...update,
            },
        }));
    };
    const setOption = (param) => (newValue) => {
        const update = {};
        update[param] = newValue;
        setPreset((prevState) => cleanupPreset({
            preset: {
                ...prevState,
                ...update,
            },
        }));
    };
    const setExample = (i, type, newValue = null) => {
        const update = {};
        const current = preset?.examples?.slice() || [];
        const currentExample = { ...current[i] };
        currentExample[type] = { content: newValue };
        current[i] = currentExample;
        update['examples'] = current;
        setPreset((prevState) => cleanupPreset({
            preset: {
                ...prevState,
                ...update,
            },
        }));
    };
    const addExample = () => {
        const update = {};
        const current = preset?.examples?.slice() || [];
        current.push({ input: { content: '' }, output: { content: '' } });
        update['examples'] = current;
        setPreset((prevState) => cleanupPreset({
            preset: {
                ...prevState,
                ...update,
            },
        }));
    };
    const removeExample = () => {
        const update = {};
        const current = preset?.examples?.slice() || [];
        if (current.length <= 1) {
            update['examples'] = [{ input: { content: '' }, output: { content: '' } }];
            setPreset((prevState) => cleanupPreset({
                preset: {
                    ...prevState,
                    ...update,
                },
            }));
            return;
        }
        current.pop();
        update['examples'] = current;
        setPreset((prevState) => cleanupPreset({
            preset: {
                ...prevState,
                ...update,
            },
        }));
    };
    return {
        setOption,
        setExample,
        addExample,
        setOptions,
        removeExample,
        getConversation,
    };
};
export default usePresetIndexOptions;
