import { forwardRef } from 'react';
import { Input, Label, SecretInput } from '@librechat/client';
import { cn } from '~/utils/';
import { useLocalize } from '~/hooks';
const InputWithLabel = forwardRef((props, ref) => {
    const { id, value, label, secret = false, subLabel, onChange, labelClassName = '', inputClassName = '', } = props;
    const localize = useLocalize();
    return (<>
      <div className={cn('mt-4 flex flex-row', labelClassName)}>
        <Label htmlFor={id} className="text-left text-sm font-medium">
          {label}
        </Label>
        {subLabel && (<Label className="mx-1 text-right text-sm text-text-secondary">{subLabel}</Label>)}
        <br />
      </div>
      <div className="h-1"/>
      {secret ? (<SecretInput id={id} data-testid={`input-${id}`} value={value ?? ''} onChange={onChange} ref={ref} autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" controlsOnHover placeholder={`${localize('com_endpoint_config_value')} ${label}`} className={cn('flex h-10 max-h-10 w-full resize-none px-3 py-2', inputClassName)}/>) : (<Input id={id} data-testid={`input-${id}`} value={value ?? ''} onChange={onChange} ref={ref} placeholder={`${localize('com_endpoint_config_value')} ${label}`} className={cn('flex h-10 max-h-10 w-full resize-none px-3 py-2', inputClassName)}/>)}
    </>);
});
export default InputWithLabel;
