import type { TranslationKeys } from '~/hooks';
import { normalizeError, getLocalizedErrorMessage, isAppError } from 'librechat-data-provider';
import type { AppError, ErrorCode } from 'librechat-data-provider';

type LocalizeFn = (key: TranslationKeys, options?: Record<string, string>) => string;

/**
 * Builds a localized error message from an favorites/skill-favorites mutation rejection.
 * Uses the unified error normalization system to recognize MAX_*_EXCEEDED codes.
 */
export function getFavoritesErrorMessage(
  error: unknown,
  localize: LocalizeFn,
  defaultLimit: number,
): string {
  const appError: AppError = isAppError(error)
    ? error
    : normalizeError(error, {
        fallbackMessage: localize('com_ui_error'),
      });

  if (
    appError.code === ('MAX_FAVORITES_EXCEEDED' as ErrorCode) ||
    appError.code === ('MAX_SKILL_FAVORITES_EXCEEDED' as ErrorCode) ||
    appError.details?.['code'] === 'MAX_FAVORITES_EXCEEDED' ||
    appError.details?.['code'] === 'MAX_SKILL_FAVORITES_EXCEEDED'
  ) {
    const limit = (appError.details?.['limit'] as number) ?? defaultLimit;
    return localize('com_ui_max_favorites_reached', {
      0: String(limit),
    });
  }

  return getLocalizedErrorMessage(appError, localize as (key: string, options?: Record<string, unknown>) => string);
}
