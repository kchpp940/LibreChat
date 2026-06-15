import { createContext, useContext } from 'react';
export const SearchContext = createContext({});
export const useSearchContext = () => useContext(SearchContext);
