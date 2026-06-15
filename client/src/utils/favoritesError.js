import { normalizeError, getLocalizedErrorMessage, isAppError } from 'librechat-data-provider';

/**
 * Builds a localized error message from an favorites/skill-favorites mutation rejection.
 * Uses the unified error normalization system to recognize MAX_*_EXCEEDED codes.
 */
export function getFavoritesErrorMessage(error, localize, defaultLimit) {
  const appError = isAppError(error)
    ? error
    : normalizeError(error, { fallbackMessage: localize('com_ui_error') });

  if (
    appError.code === 'MAX_FAVORITES_EXCEEDED' ||
    appError.code === 'MAX_SKILL_FAVORITES_EXCEEDED' ||
    appError.details?.['code'] === 'MAX_FAVORITES_EXCEEDED' ||
    appError.details?.['code'] === 'MAX_SKILL_FAVORITES_EXCEEDED'
  ) {
    const limit = (appError.details?.['limit']) ?? defaultLimit;
    return localize('com_ui_max_favorites_reached', {
      0: String(limit),
    });
  }

  return getLocalizedErrorMessage(appError, localize);
}
