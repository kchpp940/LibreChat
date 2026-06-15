import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import SpeechRecognitionImport, { useSpeechRecognition } from 'react-speech-recognition';
import useGetAudioSettings from './useGetAudioSettings';
import { useLocalize } from '~/hooks';
import store from '~/store';
const hasSpeechRecognitionController = (controller) => typeof controller?.startListening === 'function' &&
    typeof controller.stopListening === 'function';
const speechRecognitionModule = SpeechRecognitionImport;
const SpeechRecognition = hasSpeechRecognitionController(speechRecognitionModule)
    ? speechRecognitionModule
    : speechRecognitionModule.default;
const useSpeechToTextBrowser = (setText, onTranscriptionComplete) => {
    const localize = useLocalize();
    const { showToast } = useToastContext();
    const { speechToTextEndpoint } = useGetAudioSettings();
    const isBrowserSTTEnabled = speechToTextEndpoint === 'browser';
    const { data: speechConfig } = useGetCustomConfigSpeechQuery({ enabled: true });
    const sttExternal = Boolean(speechConfig?.sttExternal);
    const lastTranscript = useRef(null);
    const lastInterim = useRef(null);
    const timeoutRef = useRef();
    const [autoSendText] = useRecoilState(store.autoSendText);
    const [languageSTT] = useRecoilState(store.languageSTT);
    const [autoTranscribeAudio] = useRecoilState(store.autoTranscribeAudio);
    const { listening, finalTranscript, resetTranscript, interimTranscript, isMicrophoneAvailable, browserSupportsSpeechRecognition, } = useSpeechRecognition();
    const isListening = listening;
    useEffect(() => {
        if (interimTranscript == null || interimTranscript === '') {
            return;
        }
        if (lastInterim.current === interimTranscript) {
            return;
        }
        setText(interimTranscript);
        lastInterim.current = interimTranscript;
    }, [setText, interimTranscript]);
    useEffect(() => {
        if (finalTranscript == null || finalTranscript === '') {
            return;
        }
        if (lastTranscript.current === finalTranscript) {
            return;
        }
        setText(finalTranscript);
        lastTranscript.current = finalTranscript;
        if (autoSendText > -1 && finalTranscript.length > 0) {
            timeoutRef.current = setTimeout(() => {
                onTranscriptionComplete(finalTranscript);
                resetTranscript();
            }, autoSendText * 1000);
        }
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [setText, onTranscriptionComplete, resetTranscript, finalTranscript, autoSendText]);
    const toggleListening = useCallback(() => {
        if (!browserSupportsSpeechRecognition) {
            showToast({
                message: sttExternal
                    ? localize('com_ui_speech_not_supported_use_external')
                    : localize('com_ui_speech_not_supported'),
                status: 'error',
            });
            return;
        }
        if (!isMicrophoneAvailable) {
            showToast({
                message: localize('com_ui_microphone_unavailable'),
                status: 'error',
            });
            return;
        }
        if (!hasSpeechRecognitionController(SpeechRecognition)) {
            showToast({
                message: sttExternal
                    ? localize('com_ui_speech_not_supported_use_external')
                    : localize('com_ui_speech_not_supported'),
                status: 'error',
            });
            return;
        }
        if (isListening === true) {
            SpeechRecognition.stopListening();
        }
        else {
            SpeechRecognition.startListening({
                language: languageSTT,
                continuous: autoTranscribeAudio,
            });
        }
    }, [
        autoTranscribeAudio,
        browserSupportsSpeechRecognition,
        isListening,
        isMicrophoneAvailable,
        languageSTT,
        localize,
        showToast,
        sttExternal,
    ]);
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.shiftKey && e.altKey && e.code === 'KeyL' && !isBrowserSTTEnabled) {
                toggleListening();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isBrowserSTTEnabled, toggleListening]);
    return {
        isListening,
        isLoading: false,
        startRecording: toggleListening,
        stopRecording: toggleListening,
    };
};
export default useSpeechToTextBrowser;
