import { createContext, useCallback, useContext, useMemo, useState } from 'react';
const STORAGE_KEY = 'side:active-panel';
export const DEFAULT_PANEL = 'conversations';
function getInitialActivePanel() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? saved : DEFAULT_PANEL;
}
const ActivePanelContext = createContext(undefined);
export function ActivePanelProvider({ children }) {
    const [active, _setActive] = useState(getInitialActivePanel);
    const setActive = useCallback((id) => {
        localStorage.setItem(STORAGE_KEY, id);
        _setActive(id);
    }, []);
    const value = useMemo(() => ({ active, setActive }), [active, setActive]);
    return <ActivePanelContext.Provider value={value}>{children}</ActivePanelContext.Provider>;
}
export function useActivePanel() {
    const context = useContext(ActivePanelContext);
    if (context === undefined) {
        throw new Error('useActivePanel must be used within an ActivePanelProvider');
    }
    return context;
}
/** Returns `active` when it matches a known link, otherwise the first link's id. */
export function resolveActivePanel(active, links) {
    if (links.length > 0 && links.some((l) => l.id === active)) {
        return active;
    }
    return links[0]?.id ?? active;
}
