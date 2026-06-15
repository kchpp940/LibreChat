import { useState, useRef, useEffect } from 'react';
const useDelayedRender = (delay) => {
    const [delayed, setDelayed] = useState(true);
    const timerPromiseRef = useRef(null);
    useEffect(() => {
        if (delayed) {
            const timerPromise = new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    setDelayed(false);
                    resolve();
                }, delay);
                return () => {
                    clearTimeout(timeout);
                };
            });
            timerPromiseRef.current = timerPromise;
        }
        return () => {
            timerPromiseRef.current = null;
        };
    }, [delay, delayed]);
    return (fn) => {
        if (delayed && timerPromiseRef.current) {
            throw timerPromiseRef.current;
        }
        return fn();
    };
};
export default useDelayedRender;
