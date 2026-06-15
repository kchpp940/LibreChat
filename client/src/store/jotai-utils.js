import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
/**
 * Create a simple atom with localStorage persistence
 * Uses Jotai's atomWithStorage with getOnInit for proper SSR support
 *
 * @param key - localStorage key
 * @param defaultValue - default value if no saved value exists
 * @returns Jotai atom with localStorage persistence
 */
export function createStorageAtom(key, defaultValue) {
    return atomWithStorage(key, defaultValue, undefined, {
        getOnInit: true,
    });
}
/**
 * Create an atom with localStorage persistence and side effects
 * Useful when you need to apply changes to the DOM or trigger other actions
 *
 * @param key - localStorage key
 * @param defaultValue - default value if no saved value exists
 * @param onWrite - callback function to run when the value changes
 * @returns Jotai atom with localStorage persistence and side effects
 */
export function createStorageAtomWithEffect(key, defaultValue, onWrite) {
    const baseAtom = createStorageAtom(key, defaultValue);
    return atom((get) => get(baseAtom), (get, set, newValue) => {
        set(baseAtom, newValue);
        if (typeof window !== 'undefined') {
            onWrite(newValue);
        }
    });
}
/**
 * Create a SyncStorage adapter that reads/writes to localStorage but does NOT
 * subscribe to browser `storage` events. This prevents cross-tab synchronization
 * for atoms where each tab should maintain independent state.
 *
 * Use this for atoms that represent per-tab working state (e.g., favorites toggle,
 * MCP server selections) rather than user preferences.
 */
export function createTabIsolatedStorage() {
    return {
        getItem(key, initialValue) {
            if (typeof window === 'undefined') {
                return initialValue;
            }
            try {
                const stored = localStorage.getItem(key);
                if (stored === null) {
                    return initialValue;
                }
                return JSON.parse(stored);
            }
            catch {
                return initialValue;
            }
        },
        setItem(key, newValue) {
            if (typeof window === 'undefined') {
                return;
            }
            try {
                localStorage.setItem(key, JSON.stringify(newValue));
            }
            catch {
                // quota exceeded or other write error — silently ignore
            }
        },
        removeItem(key) {
            if (typeof window === 'undefined') {
                return;
            }
            try {
                localStorage.removeItem(key);
            }
            catch {
                // silently ignore
            }
        },
        // subscribe intentionally omitted — prevents cross-tab sync via storage events
    };
}
/**
 * Create an atom with localStorage persistence that does NOT sync across tabs.
 * Parallels `createStorageAtom` but uses tab-isolated storage.
 *
 * @param key - localStorage key
 * @param defaultValue - default value if no saved value exists
 * @returns Jotai atom with localStorage persistence, isolated per tab
 */
export function createTabIsolatedAtom(key, defaultValue) {
    return atomWithStorage(key, defaultValue, createTabIsolatedStorage(), {
        getOnInit: true,
    });
}
/**
 * Initialize a value from localStorage and optionally apply it
 * Useful for applying saved values on app startup (e.g., theme, fontSize)
 *
 * @param key - localStorage key
 * @param defaultValue - default value if no saved value exists
 * @param onInit - optional callback to run with the loaded value
 * @returns The loaded value (or default if none exists)
 */
export function initializeFromStorage(key, defaultValue, onInit) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return defaultValue;
    }
    try {
        const savedValue = localStorage.getItem(key);
        const value = savedValue ? JSON.parse(savedValue) : defaultValue;
        if (onInit) {
            onInit(value);
        }
        return value;
    }
    catch (error) {
        console.error(`Error initializing ${key} from localStorage, using default. Error:`, error);
        // Reset corrupted value
        try {
            localStorage.setItem(key, JSON.stringify(defaultValue));
        }
        catch (setError) {
            console.error(`Error resetting corrupted ${key} in localStorage:`, setError);
        }
        if (onInit) {
            onInit(defaultValue);
        }
        return defaultValue;
    }
}
