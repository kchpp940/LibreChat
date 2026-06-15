import { OGDialogContent, OGDialog, OGDialogTitle } from '@librechat/client';
import PromptDetails from '../display/PromptDetails';
import { useLocalize } from '~/hooks';
const PreviewPrompt = ({ group, open, onOpenChange, onCloseAutoFocus, }) => {
    const localize = useLocalize();
    return (<OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-5xl overflow-hidden" onCloseAutoFocus={onCloseAutoFocus}>
        <OGDialogTitle className="sr-only">{localize('com_ui_preview')}</OGDialogTitle>
        <PromptDetails group={group} onUsePrompt={() => onOpenChange(false)}/>
      </OGDialogContent>
    </OGDialog>);
};
export default PreviewPrompt;
