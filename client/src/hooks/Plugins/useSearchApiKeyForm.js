import { useRef, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import useAuthSearchTool from '~/hooks/Plugins/useAuthSearchTool';
export default function useSearchApiKeyForm({ onSubmit, onRevoke, }) {
    const methods = useForm();
    const menuTriggerRef = useRef(null);
    const badgeTriggerRef = useRef(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { installTool, removeTool } = useAuthSearchTool({ isEntityTool: true });
    const { reset } = methods;
    const onSubmitHandler = useCallback((data) => {
        installTool(data);
        setIsDialogOpen(false);
        onSubmit?.();
    }, [onSubmit, installTool]);
    const handleRevokeApiKey = useCallback(() => {
        reset();
        removeTool();
        setIsDialogOpen(false);
        onRevoke?.();
    }, [reset, onRevoke, removeTool]);
    return {
        methods,
        isDialogOpen,
        setIsDialogOpen,
        handleRevokeApiKey,
        onSubmit: onSubmitHandler,
        badgeTriggerRef,
        menuTriggerRef,
    };
}
