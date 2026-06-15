import { createContext, useContext } from 'react';
export const BookmarkContext = createContext({
    bookmarks: [],
});
export const useBookmarkContext = () => useContext(BookmarkContext);
