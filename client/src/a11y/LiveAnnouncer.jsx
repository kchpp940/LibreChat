import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import AnnouncerContext from '~/Providers/AnnouncerContext';
import { useLocalize } from '~/hooks';
import Announcer from './Announcer';
const LiveAnnouncer = ({ children }) => {
    const [statusMessage, setStatusMessage] = useState('');
    const [logMessage, setLogMessage] = useState('');
    const statusTimeoutRef = useRef(null);
    const localize = useLocalize();
    const events = useMemo(() => ({
        start: localize('com_a11y_start'),
        end: localize('com_a11y_end'),
        composing: localize('com_a11y_ai_composing'),
        summarize_started: localize('com_a11y_summarize_started'),
        summarize_completed: localize('com_a11y_summarize_completed'),
        summarize_failed: localize('com_a11y_summarize_failed'),
    }), [localize]);
    const announceStatus = useCallback((message) => {
        if (statusTimeoutRef.current) {
            clearTimeout(statusTimeoutRef.current);
        }
        setStatusMessage(message);
        statusTimeoutRef.current = setTimeout(() => {
            setStatusMessage('');
        }, 1000);
    }, []);
    const announceLog = useCallback((message) => {
        setLogMessage(message);
    }, []);
    const announcePolite = useCallback(({ message, isStatus = false }) => {
        const finalMessage = (events[message] ?? message).replace(/[*`_]/g, '');
        if (isStatus) {
            announceStatus(finalMessage);
        }
        else {
            announceLog(finalMessage);
        }
    }, [events, announceStatus, announceLog]);
    const announceAssertive = announcePolite;
    const contextValue = useMemo(() => ({
        announcePolite,
        announceAssertive,
    }), [announcePolite, announceAssertive]);
    useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
        };
    }, []);
    return (<AnnouncerContext.Provider value={contextValue}>
      {children}
      <Announcer statusMessage={statusMessage} logMessage={logMessage}/>
    </AnnouncerContext.Provider>);
};
export default LiveAnnouncer;
