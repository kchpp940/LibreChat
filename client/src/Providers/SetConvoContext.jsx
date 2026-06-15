import { createContext, useContext, useRef } from 'react';
export const SetConvoContext = createContext({});
export const SetConvoProvider = ({ children }) => {
    const hasSetConversation = useRef(false);
    return <SetConvoContext.Provider value={hasSetConversation}>{children}</SetConvoContext.Provider>;
};
export const useSetConvoContext = () => useContext(SetConvoContext);
