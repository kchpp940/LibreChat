const isApiError = (error) => typeof error === 'object' && error !== null && 'response' in error;
/**
 * Builds a localized error message from an axios-shaped favorites/skill-favorites
 * mutation rejection. Recognizes the `MAX_*_EXCEEDED` codes the backend emits and
 * falls back to the generic error string otherwise.
 */
export function getFavoritesErrorMessage(error, localize, defaultLimit) {
    if (isApiError(error)) {
        const { code, limit } = error.response?.data ?? {};
        if (code === 'MAX_FAVORITES_EXCEEDED' || code === 'MAX_SKILL_FAVORITES_EXCEEDED') {
            return localize('com_ui_max_favorites_reached', {
                0: String(limit ?? defaultLimit),
            });
        }
    }
    return localize('com_ui_error');
}
