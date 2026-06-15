import { memo } from 'react';
import { useRecoilValue } from 'recoil';
import { BrowserTTS, ExternalTTS } from '~/components/Audio/TTS';
import { TTSEndpoints } from '~/common';
import store from '~/store';
function MessageAudio(props) {
    const engineTTS = useRecoilValue(store.engineTTS);
    const TTSComponents = {
        [TTSEndpoints.browser]: BrowserTTS,
        [TTSEndpoints.external]: ExternalTTS,
    };
    const SelectedTTS = TTSComponents[engineTTS];
    if (!SelectedTTS) {
        return null;
    }
    return <SelectedTTS {...props}/>;
}
export default memo(MessageAudio);
