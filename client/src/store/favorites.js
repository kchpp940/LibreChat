import { createTabIsolatedAtom } from './jotai-utils';
/**
 * This atom stores the user's favorite models/agents
 */
export const favoritesAtom = createTabIsolatedAtom('favorites', []);
