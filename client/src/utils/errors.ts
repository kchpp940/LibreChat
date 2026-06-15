import {
  normalizeError,
  isNotFoundError as _isNotFoundError,
  getErrorStatus,
  isAppError,
  isForbiddenError,
  isUnauthorizedError,
  isNetworkError,
  isRateLimitError,
  isValidationError,
  isServerError,
  isFileError,
  isRetryableError,
  isAbortedError,
  getErrorMessage,
  getValidationIssues,
  getRateLimitInfo,
  getLocalizedErrorMessage,
} from 'librechat-data-provider';
import type { AppError, ErrorCode, ErrorCategory } from 'librechat-data-provider';

export {
  normalizeError,
  isAppError,
  isForbiddenError,
  isUnauthorizedError,
  isNetworkError,
  isRateLimitError,
  isValidationError,
  isServerError,
  isFileError,
  isRetryableError,
  isAbortedError,
  getErrorMessage,
  getValidationIssues,
  getRateLimitInfo,
  getLocalizedErrorMessage,
};
export type { AppError, ErrorCode, ErrorCategory };

export const getResponseStatus = getErrorStatus;

export const isNotFoundError = _isNotFoundError;
