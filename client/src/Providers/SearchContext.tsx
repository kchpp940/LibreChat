import { createContext, useContext } from 'react';
import type { SearchResultData } from 'librechat-data-provider';

export type SearchContextValue = {
  searchResults?: { [key: string]: SearchResultData };
};

export const SearchContext = createContext<SearchContextValue>({} as SearchContextValue);
export const useSearchContext = () => useContext(SearchContext);
