import { useRef, useState, useCallback, useEffect } from 'react';
import copy from 'copy-to-clipboard';
export default function useCopyCode(codeRef) {
    const [isCopied, setIsCopied] = useState(false);
    const buttonRef = useRef(null);
    const timerRef = useRef();
    useEffect(() => {
        return () => clearTimeout(timerRef.current);
    }, []);
    const handleCopy = useCallback(() => {
        const codeString = codeRef.current?.textContent;
        if (codeString == null) {
            return;
        }
        const wasFocused = document.activeElement === buttonRef.current;
        setIsCopied(true);
        copy(codeString.trim(), { format: 'text/plain' });
        if (wasFocused) {
            requestAnimationFrame(() => buttonRef.current?.focus());
        }
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setIsCopied(false);
        }, 3000);
    }, [codeRef]);
    return { isCopied, buttonRef, handleCopy };
}
