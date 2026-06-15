import React, { forwardRef } from 'react';
import { useWatch } from 'react-hook-form';
import { SendIcon, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
const SubmitButton = React.memo(forwardRef((props, ref) => {
    const localize = useLocalize();
    return (<TooltipAnchor description={localize('com_nav_send_message')} render={<button ref={ref} aria-label={localize('com_nav_send_message')} id="send-button" disabled={props.disabled} className={cn('rounded-full bg-text-primary p-1.5 text-text-primary outline-offset-4 transition-all duration-200 disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-10')} data-testid="send-button" type="submit">
            <span className="" data-state="closed">
              <SendIcon size={24}/>
            </span>
          </button>}/>);
}));
const SendButton = React.memo(forwardRef((props, ref) => {
    const data = useWatch({ control: props.control });
    const content = data?.text?.trim();
    return <SubmitButton ref={ref} disabled={props.disabled || !content}/>;
}));
export default SendButton;
