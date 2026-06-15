import { useState } from 'react';
import { useToastContext } from '@librechat/client';
import { useLocalize } from '~/hooks';
export const useDelayedUploadToast = () => {
    const localize = useLocalize();
    const { showToast } = useToastContext();
    const [uploadTimers, setUploadTimers] = useState({});
    const determineDelay = (fileSize) => {
        const baseDelay = 5000;
        const additionalDelay = Math.floor(fileSize / 1000000) * 2000;
        return baseDelay + additionalDelay;
    };
    const startUploadTimer = (fileId, fileName, fileSize) => {
        const delay = determineDelay(fileSize);
        if (uploadTimers[fileId]) {
            clearTimeout(uploadTimers[fileId]);
        }
        const timer = setTimeout(() => {
            const message = localize('com_ui_upload_delay', { 0: fileName });
            showToast({
                message,
                status: 'warning',
                duration: 10000,
            });
        }, delay);
        setUploadTimers((prev) => ({ ...prev, [fileId]: timer }));
    };
    const clearUploadTimer = (fileId) => {
        if (uploadTimers[fileId]) {
            clearTimeout(uploadTimers[fileId]);
            setUploadTimers((prev) => {
                const { [fileId]: _, ...rest } = prev;
                return rest;
            });
        }
    };
    return { startUploadTimer, clearUploadTimer };
};
