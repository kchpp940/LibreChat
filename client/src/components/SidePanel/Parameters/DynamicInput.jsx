import { OptionTypes } from 'librechat-data-provider';
import { Label, Input, HoverCard, HoverCardTrigger } from '@librechat/client';
import { useLocalize, useDebouncedInput, useParameterEffects } from '~/hooks';
import { useChatContext } from '~/Providers';
import OptionHover from './OptionHover';
import { ESide } from '~/common';
import { cn } from '~/utils';
function DynamicInput({ label = '', settingKey, defaultValue, description = '', columnSpan, setOption, optionType, placeholder = '', readonly = false, showDefault = false, labelCode = false, descriptionCode = false, placeholderCode = false, conversation, }) {
    const localize = useLocalize();
    const { preset } = useChatContext();
    const [setInputValue, inputValue, setLocalValue] = useDebouncedInput({
        optionKey: settingKey,
        initialValue: optionType !== OptionTypes.Custom ? conversation?.[settingKey] : defaultValue,
        setter: () => ({}),
        setOption,
    });
    useParameterEffects({
        preset,
        settingKey,
        defaultValue: typeof defaultValue === 'undefined' ? '' : defaultValue,
        conversation,
        inputValue,
        setInputValue: setLocalValue,
    });
    const handleInputChange = (e) => {
        setInputValue(e, !isNaN(Number(e.target.value)));
    };
    const placeholderText = placeholderCode
        ? localize(placeholder) || placeholder
        : placeholder;
    return (<div className={`flex flex-col items-center justify-start gap-6 ${columnSpan != null ? `col-span-${columnSpan}` : 'col-span-full'}`}>
      <HoverCard openDelay={300}>
        <HoverCardTrigger className="grid w-full items-center gap-2">
          <div className="flex w-full justify-between">
            <Label htmlFor={`${settingKey}-dynamic-input`} className="text-left text-xs font-medium">
              {labelCode ? localize(label) || label : label || settingKey}{' '}
              {showDefault && (<small className="opacity-40">
                  (
                  {typeof defaultValue === 'undefined' || !defaultValue.length
                ? localize('com_endpoint_default_blank')
                : `${localize('com_endpoint_default')}: ${defaultValue}`}
                  )
                </small>)}
            </Label>
          </div>
          <Input id={`${settingKey}-dynamic-input`} disabled={readonly} value={inputValue ?? defaultValue ?? ''} onChange={handleInputChange} placeholder={placeholderText} className={cn('flex h-9 max-h-9 w-full resize-none rounded-lg border border-border-light bg-surface-secondary px-3 py-2')}/>
        </HoverCardTrigger>
        {description && (<OptionHover description={descriptionCode
                ? localize(description) || description
                : description} side={ESide.Left}/>)}
      </HoverCard>
    </div>);
}
export default DynamicInput;
