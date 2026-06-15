import { createContext, useContext } from 'react';
export const AgentsMapContext = createContext({});
export const useAgentsMapContext = () => useContext(AgentsMapContext);
