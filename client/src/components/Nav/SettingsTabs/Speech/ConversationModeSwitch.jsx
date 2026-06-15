import { useRecoilState, useRecoilValue } from 'recoil';
import ToggleSwitch from '../ToggleSwitch';
import store from '~/store';
export default function ConversationModeSwitch({ onCheckedChange, }) {
    const speechToText = useRecoilValue(store.speechToText);
    const textToSpeech = useRecoilValue(store.textToSpeech);
    const [, setAutoSendText] = useRecoilState(store.autoSendText);
    const [, setDecibelValue] = useRecoilState(store.decibelValue);
    const [, setAutoTranscribeAudio] = useRecoilState(store.autoTranscribeAudio);
    const handleCheckedChange = (value) => {
        setAutoTranscribeAudio(value);
        setAutoSendText(3);
        setDecibelValue(-45);
        if (onCheckedChange) {
            onCheckedChange(value);
        }
    };
    return (<ToggleSwitch stateAtom={store.conversationMode} localizationKey={'com_nav_conversation_mode'} switchId="ConversationMode" onCheckedChange={handleCheckedChange} disabled={!textToSpeech || !speechToText} strongLabel={true}/>);
}
