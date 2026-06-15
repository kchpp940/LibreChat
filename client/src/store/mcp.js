import { atom } from 'jotai';
import { atomFamily, atomWithStorage } from 'jotai/utils';
import { Constants, LocalStorageKeys } from 'librechat-data-provider';
import { createTabIsolatedStorage } from './jotai-utils';
/**
 * Tab-isolated storage for MCP values — prevents cross-tab sync so that
 * each tab's MCP server selections are independent (especially for new chats
 * which all share the same `LAST_MCP_new` localStorage key).
 */
const mcpTabIsolatedStorage = createTabIsolatedStorage();
/**
 * Creates a storage atom for MCP values per conversation
 * Uses atomFamily to create unique atoms for each conversation ID
 */
export const mcpValuesAtomFamily = atomFamily((conversationId) => {
    const key = conversationId ?? Constants.NEW_CONVO;
    const storageKey = `${LocalStorageKeys.LAST_MCP_}${key}`;
    return atomWithStorage(storageKey, [], mcpTabIsolatedStorage, { getOnInit: true });
});
/**
 * Global storage atom for MCP pinned state (shared across all conversations)
 */
export const mcpPinnedAtom = atomWithStorage(LocalStorageKeys.PIN_MCP_, true, undefined, {
    getOnInit: true,
});
const defaultServerInitState = {
    isInitializing: false,
    isCancellable: false,
    oauthUrl: null,
    oauthStartTime: null,
};
/**
 * Global atom for MCP server initialization states.
 * Keyed by server name.
 */
export const mcpServerInitStatesAtom = atom({});
/**
 * Helper to get or create a server's init state
 */
export const getServerInitState = (states, serverName) => {
    return states[serverName] || defaultServerInitState;
};
