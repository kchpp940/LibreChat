import { createContext, useContext } from 'react';
export const AssistantsMapContext = createContext({});
export const useAssistantsMapContext = () => useContext(AssistantsMapContext);
