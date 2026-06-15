import { atom } from 'recoil';
// Improved helper function to create atoms with localStorage
export function atomWithLocalStorage(key, defaultValue) {
    return atom({
        key,
        default: defaultValue,
        effects_UNSTABLE: [
            ({ setSelf, onSet }) => {
                const savedValue = localStorage.getItem(key);
                if (savedValue !== null) {
                    try {
                        const parsedValue = JSON.parse(savedValue);
                        setSelf(parsedValue);
                    }
                    catch (e) {
                        console.error(`Error parsing localStorage key "${key}", \`savedValue\`: defaultValue, error:`, e);
                        localStorage.setItem(key, JSON.stringify(defaultValue));
                        setSelf(defaultValue);
                    }
                }
                onSet((newValue) => {
                    localStorage.setItem(key, JSON.stringify(newValue));
                });
            },
        ],
    });
}
