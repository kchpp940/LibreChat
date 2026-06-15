import { createContext, useContext } from 'react';
export const MessageContext = createContext({});
export const useMessageContext = () => useContext(MessageContext);
