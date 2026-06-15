import { useEffect, useRef } from 'react';
import { defaultDebouncedDelay } from '~/common';
function useParameterEffects({ preset, settingKey, defaultValue, conversation, inputValue, setInputValue, preventDelayedUpdate = false, }) {
    const idRef = useRef(null);
    const presetIdRef = useRef(null);
    /** Updates the local state inputValue if global (conversation) is updated elsewhere */
    useEffect(() => {
        if (preventDelayedUpdate) {
            return;
        }
        const timeout = setTimeout(() => {
            if (conversation?.[settingKey] === inputValue) {
                return;
            }
            setInputValue(conversation?.[settingKey]);
        }, defaultDebouncedDelay * 1.25);
        return () => clearTimeout(timeout);
    }, [setInputValue, preventDelayedUpdate, conversation, inputValue, settingKey]);
    /** Resets the local state if conversationId changed */
    useEffect(() => {
        const conversationId = conversation?.conversationId ?? '';
        if (!conversationId) {
            return;
        }
        if (idRef.current === conversationId) {
            return;
        }
        idRef.current = conversationId;
        setInputValue(defaultValue);
    }, [setInputValue, conversation?.conversationId, defaultValue]);
    /** Resets the local state if presetId changed */
    useEffect(() => {
        const presetId = preset?.presetId ?? '';
        if (!presetId) {
            return;
        }
        if (presetIdRef.current === presetId) {
            return;
        }
        presetIdRef.current = presetId;
        setInputValue(defaultValue);
    }, [setInputValue, preset?.presetId, defaultValue]);
}
export default useParameterEffects;
