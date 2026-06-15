import { createContext, useContext } from 'react';
import useToolCallsMap from '~/hooks/Plugins/useToolCallsMap';
export const ToolCallsMapContext = createContext({});
export const useToolCallsMapContext = () => useContext(ToolCallsMapContext);
export function ToolCallsMapProvider({ children, conversationId }) {
    const toolCallsMap = useToolCallsMap({ conversationId });
    return (<ToolCallsMapContext.Provider value={toolCallsMap}>{children}</ToolCallsMapContext.Provider>);
}
