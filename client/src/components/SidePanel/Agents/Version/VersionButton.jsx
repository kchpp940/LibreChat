import { History } from 'lucide-react';
import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { Panel } from '~/common';
const VersionButton = ({ setActivePanel }) => {
    const localize = useLocalize();
    return (<Button size={'sm'} variant={'outline'} className="btn btn-neutral border-token-border-light relative h-9 w-full gap-1 rounded-lg font-medium" onClick={() => setActivePanel(Panel.version)} aria-label={localize('com_ui_agent_version')}>
      <History className="h-4 w-4 cursor-pointer" aria-hidden="true"/>
      {localize('com_ui_agent_version')}
    </Button>);
};
export default VersionButton;
