import { applyFontSize } from '@librechat/client';
import { createStorageAtomWithEffect, initializeFromStorage } from './jotai-utils';
const DEFAULT_FONT_SIZE = 'text-base';
/**
 * This atom stores the user's font size preference
 */
export const fontSizeAtom = createStorageAtomWithEffect('fontSize', DEFAULT_FONT_SIZE, applyFontSize);
/**
 * Initialize font size on app load
 * This function applies the saved font size from localStorage to the DOM
 */
export const initializeFontSize = () => {
    initializeFromStorage('fontSize', DEFAULT_FONT_SIZE, applyFontSize);
};
