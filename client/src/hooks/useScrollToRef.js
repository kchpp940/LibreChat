import { useCallback } from 'react';
import throttle from 'lodash/throttle';
export default function useScrollToRef({ targetRef, callback, smoothCallback, }) {
    const logAndScroll = (behavior, callbackFn) => {
        // Debugging:
        // console.log(`Scrolling with behavior: ${behavior}, Time: ${new Date().toISOString()}`);
        targetRef.current?.scrollIntoView({ behavior });
        callbackFn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const scrollToRef = useCallback(throttle(() => logAndScroll('instant', callback), 145, { leading: true }), [targetRef]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const scrollToRefSmooth = useCallback(throttle(() => logAndScroll('smooth', smoothCallback), 750, { leading: true }), [targetRef]);
    const handleSmoothToRef = (e) => {
        e.preventDefault();
        scrollToRefSmooth();
    };
    return {
        scrollToRef,
        handleSmoothToRef,
    };
}
