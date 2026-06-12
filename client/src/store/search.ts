import { atom } from 'recoil';
import { SearchHitType } from 'librechat-data-provider';

export type SearchState = {
  enabled: boolean | null;
  query: string;
  debouncedQuery: string;
  isSearching: boolean;
  isTyping: boolean;
  selectedTypes: SearchHitType[];
};

export const search = atom<SearchState>({
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
