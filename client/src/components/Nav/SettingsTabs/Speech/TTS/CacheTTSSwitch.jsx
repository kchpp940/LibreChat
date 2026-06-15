import { useRecoilValue } from 'recoil';
import ToggleSwitch from '../../ToggleSwitch';
import store from '~/store';
export default function CacheTTSSwitch({ onCheckedChange, }) {
    const textToSpeech = useRecoilValue(store.textToSpeech);
    return (<ToggleSwitch stateAtom={store.cacheTTS} localizationKey={'com_nav_enable_cache_tts'} switchId="CacheTTS" onCheckedChange={onCheckedChange} disabled={!textToSpeech}/>);
}
