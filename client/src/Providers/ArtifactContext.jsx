import { createContext, useContext, useCallback, useRef } from 'react';
export const ArtifactContext = createContext({});
export const useArtifactContext = () => useContext(ArtifactContext);
export function ArtifactProvider({ children, baseIndex = 0, }) {
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
    return (<ArtifactContext.Provider value={{ getNextIndex, resetCounter }}>
      {children}
    </ArtifactContext.Provider>);
}
