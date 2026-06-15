import ToggleSwitch from '../../ToggleSwitch';
import store from '~/store';
export default function AutomaticPlaybackSwitch({ onCheckedChange, }) {
    return (<ToggleSwitch stateAtom={store.automaticPlayback} localizationKey={'com_nav_automatic_playback'} switchId="AutomaticPlayback" onCheckedChange={onCheckedChange}/>);
}
