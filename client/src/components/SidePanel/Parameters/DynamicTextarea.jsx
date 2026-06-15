import { OptionTypes } from 'librechat-data-provider';
import { Label, TextareaAutosize, HoverCard, HoverCardTrigger } from '@librechat/client';
import { useLocalize, useDebouncedInput, useParameterEffects } from '~/hooks';
import { useChatContext } from '~/Providers';
import OptionHover from './OptionHover';
import { ESide } from '~/common';
import { cn } from '~/utils';
function DynamicTextarea({ label = '', settingKey, defaultValue, description = '', columnSpan, setOption, optionType, placeholder = '', readonly = false, showDefault = false, labelCode = false, descriptionCode = false, placeholderCode = false, conversation, }) {
    const localize = useLocalize();
    const { preset } = useChatContext();
    const [setInputValue, inputValue, setLocalValue] = useDebouncedInput({
        optionKey: settingKey,
        initialValue: optionType !== OptionTypes.Custom
            ? conversation?.[settingKey]
            : defaultValue,
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
    return (<div className={`flex flex-col items-center justify-start gap-6 ${columnSpan != null ? `col-span-${columnSpan}` : 'col-span-full'}`}>
      <HoverCard openDelay={300}>
        <HoverCardTrigger className="grid w-full items-center gap-2">
          <div className="flex w-full justify-between">
            <Label htmlFor={`${settingKey}-dynamic-textarea`} className="text-left text-xs font-medium">
              {labelCode ? (localize(label) ?? label) : label || settingKey}{' '}
              {showDefault && (<small className="opacity-40">
                  (
                  {typeof defaultValue === 'undefined' || !defaultValue.length
                ? localize('com_endpoint_default_blank')
                : `${localize('com_endpoint_default')}: ${defaultValue}`}
                  )
                </small>)}
            </Label>
          </div>
          <TextareaAutosize id={`${settingKey}-dynamic-textarea`} disabled={readonly} value={inputValue ?? ''} onChange={setInputValue} aria-label={localize(label)} placeholder={placeholderCode
            ? (localize(placeholder) ?? placeholder)
            : placeholder} className={cn('flex max-h-[138px] min-h-[100px] w-full resize-none rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm focus:outline-none')}/>
        </HoverCardTrigger>
        {description && (<OptionHover description={descriptionCode
                ? (localize(description) ?? description)
                : description} side={ESide.Left}/>)}
      </HoverCard>
    </div>);
}
export default DynamicTextarea;
