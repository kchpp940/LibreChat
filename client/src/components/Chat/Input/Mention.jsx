import { memo, useState, useRef, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { AutoSizer, List } from 'react-virtualized';
import { Spinner, useCombobox } from '@librechat/client';
import { EModelEndpoint } from 'librechat-data-provider';
import { useGetConversation, useLocalize } from '~/hooks';
import useInitPopoverInput from '~/hooks/Input/useInitPopoverInput';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { useAssistantsMapContext } from '~/Providers';
import useMentions from '~/hooks/Input/useMentions';
import { removeCharIfLast } from '~/utils';
import MentionItem from './MentionItem';
const ROW_HEIGHT = 44;
function MentionContent({ popoverAtom, newConversation, textAreaRef, commandChar = '@', placeholder = 'com_ui_mention', includeAssistants = true, }) {
    const localize = useLocalize();
    const getConversation = useGetConversation(0);
    const assistantsMap = useAssistantsMapContext();
    const setShowPopover = useSetRecoilState(popoverAtom);
    const { options, presets, isLoading, modelSpecs, agentsList, modelsConfig, endpointsConfig, assistantListMap, } = useMentions({ assistantMap: assistantsMap || {}, includeAssistants });
    const { onSelectMention } = useSelectMention({
        presets,
        modelSpecs,
        assistantsMap,
        endpointsConfig,
        getConversation,
        newConversation,
    });
    const [activeIndex, setActiveIndex] = useState(0);
    const timeoutRef = useRef(null);
    const inputRef = useRef(null);
    const [inputOptions, setInputOptions] = useState(options);
    const { open, setOpen, searchValue, setSearchValue, matches } = useCombobox({
        value: '',
        options: inputOptions,
    });
    const initInputRef = useInitPopoverInput({
        inputRef,
        textAreaRef,
        commandChar,
        setSearchValue,
        setOpen,
    });
    const handleSelect = (mention) => {
        if (!mention) {
            return;
        }
        const defaultSelect = () => {
            setSearchValue('');
            setOpen(false);
            setShowPopover(false);
            onSelectMention?.(mention);
            if (textAreaRef.current) {
                removeCharIfLast(textAreaRef.current, commandChar);
            }
        };
        if (mention.type === 'endpoint' && mention.value === EModelEndpoint.agents) {
            setSearchValue('');
            setInputOptions(agentsList ?? []);
            setActiveIndex(0);
            inputRef.current?.focus();
        }
        else if (mention.type === 'endpoint' && mention.value === EModelEndpoint.assistants) {
            setSearchValue('');
            setInputOptions(assistantListMap[EModelEndpoint.assistants] ?? []);
            setActiveIndex(0);
            inputRef.current?.focus();
        }
        else if (mention.type === 'endpoint' && mention.value === EModelEndpoint.azureAssistants) {
            setSearchValue('');
            setInputOptions(assistantListMap[EModelEndpoint.azureAssistants] ?? []);
            setActiveIndex(0);
            inputRef.current?.focus();
        }
        else if (mention.type === 'endpoint') {
            const models = (modelsConfig?.[mention.value || ''] ?? []).map((model) => ({
                value: mention.value,
                label: model,
                type: 'model',
            }));
            setActiveIndex(0);
            setSearchValue('');
            setInputOptions(models);
            inputRef.current?.focus();
        }
        else {
            defaultSelect();
        }
    };
    useEffect(() => {
        if (!open) {
            setInputOptions(options);
            setActiveIndex(0);
        }
    }, [open, options]);
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);
    const type = commandChar !== '@' ? 'add-convo' : 'mention';
    useEffect(() => {
        const currentActiveItem = document.getElementById(`${type}-item-${activeIndex}`);
        currentActiveItem?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }, [type, activeIndex]);
    const rowRenderer = ({ index, key, style, }) => {
        const mention = matches[index];
        return (<MentionItem type={type} index={index} key={key} style={style} onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                timeoutRef.current = null;
                handleSelect(mention);
            }} name={mention.label ?? ''} icon={mention.icon} description={mention.description} isActive={index === activeIndex}/>);
    };
    return (<div className="absolute bottom-28 z-10 w-full space-y-2">
      <div className="popover border-token-border-light rounded-2xl border bg-white p-2 shadow-lg dark:bg-gray-700">
        <input ref={initInputRef} placeholder={localize(placeholder)} className="mb-1 w-full border-0 bg-white p-2 text-sm focus:outline-none dark:bg-gray-700 dark:text-gray-200" autoComplete="off" value={searchValue} onKeyDown={(e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                setShowPopover(false);
                textAreaRef.current?.focus();
            }
            if (e.key === 'ArrowDown') {
                setActiveIndex((prevIndex) => (prevIndex + 1) % matches.length);
            }
            else if (e.key === 'ArrowUp') {
                setActiveIndex((prevIndex) => (prevIndex - 1 + matches.length) % matches.length);
            }
            else if (e.key === 'Enter' || e.key === 'Tab') {
                const mentionOption = matches[activeIndex];
                if (mentionOption?.type === 'endpoint') {
                    e.preventDefault();
                }
                else if (e.key === 'Enter') {
                    e.preventDefault();
                }
                handleSelect(matches[activeIndex]);
            }
            else if (e.key === 'Backspace' && searchValue === '') {
                setOpen(false);
                setShowPopover(false);
                textAreaRef.current?.focus();
            }
        }} onChange={(e) => setSearchValue(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => {
            timeoutRef.current = setTimeout(() => {
                setOpen(false);
                setShowPopover(false);
            }, 150);
        }}/>
        {open && isLoading && matches.length === 0 && (<div className="flex h-32 items-center justify-center text-text-primary">
            <Spinner />
          </div>)}
        {open && matches.length > 0 && (<div className="max-h-40">
            <AutoSizer disableHeight>
              {({ width }) => (<List width={width} overscanRowCount={5} rowHeight={ROW_HEIGHT} rowCount={matches.length} rowRenderer={rowRenderer} scrollToIndex={activeIndex} height={Math.min(matches.length * ROW_HEIGHT, 160)}/>)}
            </AutoSizer>
          </div>)}
      </div>
    </div>);
}
const MentionPopoverContainer = memo(function MentionPopoverContainer({ index: _index, popoverAtom, ...rest }) {
    const show = useRecoilValue(popoverAtom);
    if (!show) {
        return null;
    }
    return <MentionContent popoverAtom={popoverAtom} {...rest}/>;
});
export default MentionPopoverContainer;
