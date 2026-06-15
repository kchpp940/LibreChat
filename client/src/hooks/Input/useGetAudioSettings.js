import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import store from '~/store';
const useGetAudioSettings = () => {
    const engineSTT = useRecoilValue(store.engineSTT);
    const engineTTS = useRecoilValue(store.engineTTS);
    const speechToTextEndpoint = engineSTT;
    const textToSpeechEndpoint = engineTTS;
    return useMemo(() => ({ speechToTextEndpoint, textToSpeechEndpoint }), [speechToTextEndpoint, textToSpeechEndpoint]);
};
export default useGetAudioSettings;
