import { useCallback } from 'react';
import { unstable_usePrompt, useBeforeUnload } from 'react-router-dom';
export default function useUnsavedChangesPrompt({ when, message }) {
    useBeforeUnload(useCallback((event) => {
        if (!when) {
            return;
        }
        event.preventDefault();
        event.returnValue = message;
    }, [message, when]), { capture: true });
    unstable_usePrompt({
        message,
        when: ({ currentLocation, nextLocation }) => {
            if (!when) {
                return false;
            }
            return (currentLocation.pathname !== nextLocation.pathname ||
                currentLocation.search !== nextLocation.search ||
                currentLocation.hash !== nextLocation.hash);
        },
    });
}
