import React, { createContext, useContext, useState, useMemo } from 'react';
const MutationContext = createContext(undefined);
const CodeContext = createContext(undefined);
/**
 * Provides editor state management for artifact code editing
 * Split into two contexts to prevent unnecessary re-renders:
 * - MutationContext: for save/edit status (changes rarely)
 * - CodeContext: for code content (changes on every keystroke)
 */
export function EditorProvider({ children }) {
    const [isMutating, setIsMutating] = useState(false);
    const [currentCode, setCurrentCode] = useState();
    const mutationValue = useMemo(() => ({ isMutating, setIsMutating }), [isMutating]);
    const codeValue = useMemo(() => ({ currentCode, setCurrentCode }), [currentCode]);
    return (<MutationContext.Provider value={mutationValue}>
      <CodeContext.Provider value={codeValue}>{children}</CodeContext.Provider>
    </MutationContext.Provider>);
}
/**
 * Hook to access mutation state only
 * Use this when you only need to know about save/edit status
 */
export function useMutationState() {
    const context = useContext(MutationContext);
    if (context === undefined) {
        throw new Error('useMutationState must be used within an EditorProvider');
    }
    return context;
}
/**
 * Hook to access code state only
 * Use this when you need the current code content
 */
export function useCodeState() {
    const context = useContext(CodeContext);
    if (context === undefined) {
        throw new Error('useCodeState must be used within an EditorProvider');
    }
    return context;
}
/**
 * @deprecated Use useMutationState() and/or useCodeState() instead
 * This hook causes components to re-render on every keystroke
 */
export function useEditorContext() {
    const mutation = useMutationState();
    const code = useCodeState();
    return { ...mutation, ...code };
}
