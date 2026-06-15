import React from 'react';
import { useRecoilState } from 'recoil';
import { Dropdown } from '@librechat/client';
import { useLocalize } from '~/hooks';
import store from '~/store';
const EngineTTSDropdown = ({ external }) => {
    const localize = useLocalize();
    const [engineTTS, setEngineTTS] = useRecoilState(store.engineTTS);
    const endpointOptions = external
        ? [
            { value: 'browser', label: localize('com_nav_browser') },
            { value: 'external', label: localize('com_nav_external') },
        ]
        : [{ value: 'browser', label: localize('com_nav_browser') }];
    const handleSelect = (value) => {
        setEngineTTS(value);
    };
    const labelId = 'engine-tts-dropdown-label';
    return (<div className="flex items-center justify-between">
      <div id={labelId}>{localize('com_nav_engine')}</div>
      <Dropdown value={engineTTS} onChange={handleSelect} options={endpointOptions} sizeClasses="w-[180px]" testId="EngineTTSDropdown" className="z-50" aria-labelledby={labelId}/>
    </div>);
};
export default EngineTTSDropdown;
