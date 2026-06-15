import { useEffect, useId, useRef, useState, } from 'react';
import { Button, Input, Label, OGDialog, OGDialogTemplate, Spinner, useToastContext, } from '@librechat/client';
import { useCreateProjectMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
export default function ProjectCreateDialog({ open, onOpenChange, onCreated, children, triggerRef, }) {
    const localize = useLocalize();
    const formId = useId();
    const inputRef = useRef(null);
    const [name, setName] = useState('');
    const createProject = useCreateProjectMutation();
    const { showToast } = useToastContext();
    useEffect(() => {
        if (!open) {
            return;
        }
        const frameId = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(frameId);
    }, [open]);
    const handleOpenChange = (nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen && !createProject.isLoading) {
            setName('');
        }
    };
    const handleCreate = async (event) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName || createProject.isLoading) {
            return;
        }
        try {
            const project = await createProject.mutateAsync({ name: trimmedName });
            setName('');
            onOpenChange(false);
            onCreated?.(project);
        }
        catch {
            showToast({
                message: localize('com_ui_project_create_error'),
                status: 'error',
            });
        }
    };
    return (<OGDialog open={open} onOpenChange={handleOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate title={localize('com_ui_create_project')} showCloseButton={true} className="w-11/12 max-w-lg bg-surface-primary text-text-primary" main={<form id={formId} onSubmit={handleCreate} className="space-y-2">
            <Label htmlFor={`${formId}-name`} className="text-sm font-medium text-text-primary">
              {localize('com_ui_project_name')}
            </Label>
            <Input id={`${formId}-name`} ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder={localize('com_ui_project_name_placeholder')} className="w-full bg-transparent text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring-primary"/>
          </form>} buttons={<Button type="submit" form={formId} variant="submit" disabled={!name.trim() || createProject.isLoading} aria-label={localize('com_ui_create_project')}>
            {createProject.isLoading ? (<Spinner className="size-4"/>) : (localize('com_ui_create_project'))}
          </Button>}/>
    </OGDialog>);
}
