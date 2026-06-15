import { createContext, useContext } from 'react';
export const ChatContext = createContext(null);
export const useChatContext = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) {
        throw new Error('useChatContext must be used within a ChatContext.Provider');
    }
    return ctx;
};
