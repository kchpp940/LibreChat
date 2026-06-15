import { createContext, useContext } from 'react';
export const FileMapContext = createContext({});
export const useFileMapContext = () => useContext(FileMapContext);
