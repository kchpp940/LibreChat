import { useState, useCallback, useMemo } from 'react';
export const useKeyDialog = () => {
    const [keyDialogOpen, setKeyDialogOpen] = useState(false);
    const [keyDialogEndpoint, setKeyDialogEndpoint] = useState(null);
    const handleOpenKeyDialog = useCallback((ep, e) => {
        e.preventDefault();
        e.stopPropagation();
        setKeyDialogEndpoint(ep);
        setKeyDialogOpen(true);
    }, []);
    const onOpenChange = useCallback((open) => {
        if (!open && keyDialogEndpoint) {
            const button = document.getElementById(`endpoint-${keyDialogEndpoint}-settings`);
            if (button) {
                setTimeout(() => {
                    button.focus();
                }, 5);
            }
        }
        setKeyDialogOpen(open);
    }, [keyDialogEndpoint]);
    return useMemo(() => ({
        keyDialogOpen,
        keyDialogEndpoint,
        onOpenChange,
        handleOpenKeyDialog,
    }), [keyDialogOpen, keyDialogEndpoint, onOpenChange, handleOpenKeyDialog]);
};
export default useKeyDialog;
