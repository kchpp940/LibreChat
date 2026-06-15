import ToggleSwitch from '../../ToggleSwitch';
import store from '~/store';
export default function SpeechToTextSwitch({ onCheckedChange, }) {
    return (<ToggleSwitch stateAtom={store.speechToText} localizationKey={'com_nav_speech_to_text'} switchId="SpeechToText" onCheckedChange={onCheckedChange} strongLabel={true}/>);
}
