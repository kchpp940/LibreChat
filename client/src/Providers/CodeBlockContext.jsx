import { createContext, useContext, useCallback, useRef } from 'react';
export const CodeBlockContext = createContext({});
export const useCodeBlockContext = () => useContext(CodeBlockContext);
export function CodeBlockProvider({ children, baseIndex = 0, }) {
    const counterRef = useRef(0);
    const getNextIndex = useCallback((skip) => {
        if (skip) {
            return baseIndex + counterRef.current;
        }
        const nextIndex = counterRef.current;
        counterRef.current += 1;
        return baseIndex + nextIndex;
    }, [baseIndex]);
    const resetCounter = useCallback(() => {
        counterRef.current = 0;
    }, []);
    return (<CodeBlockContext.Provider value={{ getNextIndex, resetCounter }}>
      {children}
    </CodeBlockContext.Provider>);
}
