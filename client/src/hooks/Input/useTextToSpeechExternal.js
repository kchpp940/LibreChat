import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { useToastContext } from '@librechat/client';
import { useTextToSpeechMutation, useVoicesQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import store from '~/store';
const createFormData = (text, voice) => {
    const formData = new FormData();
    formData.append('input', text);
    formData.append('voice', voice);
    return formData;
};
function useTextToSpeechExternal({ setIsSpeaking, audioRef, messageId, isLast, index = 0, }) {
    const localize = useLocalize();
    const { showToast } = useToastContext();
    const voice = useRecoilValue(store.voice);
    const cacheTTS = useRecoilValue(store.cacheTTS);
    const playbackRate = useRecoilValue(store.playbackRate);
    const [downloadFile, setDownloadFile] = useState(false);
    const promiseAudioRef = useRef(null);
    /* Global Audio Variables */
    const globalIsFetching = useRecoilValue(store.globalAudioFetchingFamily(index));
    const globalIsPlaying = useRecoilValue(store.globalAudioPlayingFamily(index));
    const autoPlayAudio = (blobUrl) => {
        const newAudio = new Audio(blobUrl);
        audioRef.current = newAudio;
    };
    const playAudioPromise = (blobUrl) => {
        const newAudio = new Audio(blobUrl);
        const initializeAudio = () => {
            if (playbackRate != null && playbackRate !== 1 && playbackRate > 0) {
                newAudio.playbackRate = playbackRate;
            }
        };
        initializeAudio();
        const playPromise = () => newAudio.play().then(() => setIsSpeaking(true));
        playPromise().catch((error) => {
            if (error.message &&
                error.message.includes('The play() request was interrupted by a call to pause()')) {
                console.log('Play request was interrupted by a call to pause()');
                initializeAudio();
                return playPromise().catch(console.error);
            }
            console.error(error);
            showToast({
                message: localize('com_nav_audio_play_error', { 0: error.message }),
                status: 'error',
            });
        });
        newAudio.onended = () => {
            console.log('Cached message audio ended');
            URL.revokeObjectURL(blobUrl);
            setIsSpeaking(false);
        };
        promiseAudioRef.current = newAudio;
    };
    const downloadAudio = (blobUrl) => {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'audio.mp3';
        a.click();
        setDownloadFile(false);
    };
    const { mutate: processAudio, isLoading } = useTextToSpeechMutation({
        onMutate: (variables) => {
            const inputText = (variables.get('input') ?? '');
            if (inputText.length >= 4096) {
                showToast({
                    message: localize('com_nav_long_audio_warning'),
                    status: 'warning',
                });
            }
        },
        onSuccess: async (data, variables) => {
            try {
                const inputText = (variables.get('input') ?? '');
                const audioBlob = new Blob([data], { type: 'audio/mpeg' });
                if (cacheTTS && inputText) {
                    const cache = await caches.open('tts-responses');
                    const request = new Request(inputText);
                    const response = new Response(audioBlob);
                    cache.put(request, response);
                }
                const blobUrl = URL.createObjectURL(audioBlob);
                if (downloadFile) {
                    downloadAudio(blobUrl);
                }
                autoPlayAudio(blobUrl);
            }
            catch (error) {
                showToast({
                    message: `Error processing audio: ${error.message}`,
                    status: 'error',
                });
            }
        },
        onError: (error) => {
            showToast({
                message: localize('com_nav_audio_process_error', { 0: error.message }),
                status: 'error',
            });
        },
    });
    const startMutation = (text, download) => {
        const formData = createFormData(text, voice ?? '');
        setDownloadFile(download);
        processAudio(formData);
    };
    const generateSpeechExternal = (text, download) => {
        if (cacheTTS) {
            handleCachedResponse(text, download);
        }
        else {
            startMutation(text, download);
        }
    };
    const handleCachedResponse = async (text, download) => {
        const cachedResponse = await caches.match(text);
        if (!cachedResponse) {
            return startMutation(text, download);
        }
        const audioBlob = await cachedResponse.blob();
        const blobUrl = URL.createObjectURL(audioBlob);
        if (download) {
            downloadAudio(blobUrl);
        }
        else {
            playAudioPromise(blobUrl);
        }
    };
    const cancelSpeech = () => {
        const messageAudio = document.getElementById(`audio-${messageId}`);
        const pauseAudio = (currentElement) => {
            if (currentElement) {
                currentElement.pause();
                currentElement.src && URL.revokeObjectURL(currentElement.src);
                audioRef.current = null;
            }
        };
        pauseAudio(messageAudio);
        pauseAudio(promiseAudioRef.current);
        setIsSpeaking(false);
    };
    const cancelPromiseSpeech = useCallback(() => {
        if (promiseAudioRef.current) {
            promiseAudioRef.current.pause();
            promiseAudioRef.current.src && URL.revokeObjectURL(promiseAudioRef.current.src);
            promiseAudioRef.current = null;
            setIsSpeaking(false);
        }
    }, [setIsSpeaking]);
    useEffect(() => cancelPromiseSpeech, [cancelPromiseSpeech]);
    const isFetching = useMemo(() => isLast && globalIsFetching && !globalIsPlaying, [globalIsFetching, globalIsPlaying, isLast]);
    const { data: voicesData = [] } = useVoicesQuery();
    return {
        generateSpeechExternal,
        cancelSpeech,
        isLoading: isFetching || isLoading,
        audioRef,
        voices: voicesData,
    };
}
export default useTextToSpeechExternal;
