import { atom } from 'recoil';
export const search = atom({
    key: 'search',
    default: {
        enabled: null,
        query: '',
        debouncedQuery: '',
        isSearching: false,
        isTyping: false,
        selectedTypes: [],
    },
});
export default {
    search,
};
