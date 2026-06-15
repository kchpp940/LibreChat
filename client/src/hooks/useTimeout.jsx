import { useEffect, useRef } from 'react';
function useTimeout({ callback, delay = 400 }) {
    const timeout = useRef(null);
    const callOnTimeout = (value) => {
        // Clear existing timeout
        if (timeout.current !== null) {
            clearTimeout(timeout.current);
        }
        // Set new timeout
        if (value != null && value) {
            console.log(value);
            timeout.current = setTimeout(() => {
                callback(value);
            }, delay);
        }
    };
    // Clear timeout when the component unmounts
    useEffect(() => {
        return () => {
            if (timeout.current !== null) {
                clearTimeout(timeout.current);
            }
        };
    }, []);
    return callOnTimeout;
}
export default useTimeout;
