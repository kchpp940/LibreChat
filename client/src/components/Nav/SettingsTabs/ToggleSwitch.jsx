import { useAtom } from 'jotai';
import { useRecoilState } from 'recoil';
import { Switch, InfoHoverCard, ESide } from '@librechat/client';
import { useLocalize } from '~/hooks';
function isRecoilState(atom) {
    return atom != null && typeof atom === 'object' && 'key' in atom;
}
const RecoilToggle = ({ stateAtom, localizationKey, hoverCardText, switchId, onCheckedChange, disabled = false, strongLabel = false, }) => {
    const [switchState, setSwitchState] = useRecoilState(stateAtom);
    const localize = useLocalize();
    const handleCheckedChange = (value) => {
        setSwitchState(value);
        onCheckedChange?.(value);
    };
    const labelId = `${switchId}-label`;
    return (<div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div id={labelId}>
          {strongLabel ? <strong>{localize(localizationKey)}</strong> : localize(localizationKey)}
        </div>
        {hoverCardText && <InfoHoverCard side={ESide.Bottom} text={localize(hoverCardText)}/>}
      </div>
      <Switch id={switchId} checked={switchState} onCheckedChange={handleCheckedChange} disabled={disabled} className="ml-4" data-testid={switchId} aria-labelledby={labelId}/>
    </div>);
};
const JotaiToggle = ({ stateAtom, localizationKey, hoverCardText, switchId, onCheckedChange, disabled = false, strongLabel = false, }) => {
    const [switchState, setSwitchState] = useAtom(stateAtom);
    const localize = useLocalize();
    const handleCheckedChange = (value) => {
        setSwitchState(value);
        onCheckedChange?.(value);
    };
    const labelId = `${switchId}-label`;
    return (<div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div id={labelId}>
          {strongLabel ? <strong>{localize(localizationKey)}</strong> : localize(localizationKey)}
        </div>
        {hoverCardText && <InfoHoverCard side={ESide.Bottom} text={localize(hoverCardText)}/>}
      </div>
      <Switch id={switchId} checked={switchState} onCheckedChange={handleCheckedChange} disabled={disabled} className="ml-4" data-testid={switchId} aria-labelledby={labelId}/>
    </div>);
};
const ToggleSwitch = (props) => {
    const { stateAtom, showSwitch = true } = props;
    if (!showSwitch) {
        return null;
    }
    const isRecoil = isRecoilState(stateAtom);
    if (isRecoil) {
        return <RecoilToggle {...props} stateAtom={stateAtom}/>;
    }
    return <JotaiToggle {...props} stateAtom={stateAtom}/>;
};
export default ToggleSwitch;
