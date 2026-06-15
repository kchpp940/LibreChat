import React, { useMemo } from 'react';
import { OGDialog, OGDialogTitle, OGDialogContent } from '@librechat/client';
import VariableForm from '../forms/VariableForm';
import { detectVariables } from '~/utils';
const VariableDialog = ({ open, onClose, group }) => {
    const handleOpenChange = (open) => {
        if (!open) {
            onClose();
        }
    };
    const hasVariables = useMemo(() => detectVariables(group?.productionPrompt?.prompt ?? ''), [group?.productionPrompt?.prompt]);
    if (!group) {
        return null;
    }
    if (!hasVariables) {
        return null;
    }
    return (<OGDialog open={open} onOpenChange={handleOpenChange}>
      <OGDialogContent className="max-h-[90vh] max-w-full overflow-y-auto bg-surface-primary text-text-primary md:max-w-[60vw]">
        <OGDialogTitle>{group.name}</OGDialogTitle>
        <VariableForm group={group} onClose={onClose}/>
      </OGDialogContent>
    </OGDialog>);
};
export default VariableDialog;
