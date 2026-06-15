import { createContext, useContext } from 'react';
export const AddedChatContext = createContext({});
export const useAddedChatContext = () => useContext(AddedChatContext);
