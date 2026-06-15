import debounce from 'lodash/debounce';
import { useState, useCallback, useMemo } from 'react';
import { defaultDebouncedDelay } from '~/common';
/** A custom hook that accepts a setOption function and an option key (e.g., 'title').
It manages a local state for the option value, a debounced setter function for that value,
and returns the local state value, its setter, and an onChange handler suitable for inputs. */
function useDebouncedInput({ setOption, setter, optionKey, initialValue, delay = defaultDebouncedDelay, }) {
    const [value, setValue] = useState(initialValue);
    /** A debounced function to call the passed setOption with the optionKey and new value.
     *
    Note: We use useMemo to ensure our debounced function is stable across renders and properly typed. */
    const setDebouncedOption = useMemo(() => debounce(setOption && optionKey ? setOption(optionKey) : setter || (() => { }), delay), [setOption, optionKey, setter, delay]);
    /** An onChange handler that updates the local state and the debounced option */
    const onChange = useCallback((e, numeric) => {
        let newValue = typeof e !== 'object'
            ? e
            : e.target
                .value;
        // Handle numeric conversion only if value is not undefined and not empty string
        if (numeric === true && newValue !== undefined && newValue !== '') {
            newValue = Number(newValue);
        }
        setValue(newValue);
        setDebouncedOption(newValue);
    }, [setDebouncedOption]);
    return [onChange, value, setValue];
}
export default useDebouncedInput;
