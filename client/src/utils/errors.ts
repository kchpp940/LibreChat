import {
  normalizeError,
  isNotFoundError as _isNotFoundError,
  isForbiddenError,
  isUnauthorizedError,
  isNetworkError,
  isRateLimitError,
  isValidationError,
  isServerError,
  isConflictError,
  isServerNotReadyError,
  isFileError,
  isRetryableError,
  isAbortedError,
  isAppError,
  getErrorStatus,
  getErrorMessage,
  getValidationIssues,
  getRateLimitInfo,
  getLocalizedErrorMessage,
  ErrorCode,
  ErrorCategory,
} from 'librechat-data-provider';
import type { AppError } from 'librechat-data-provider';

export {
  normalizeError,
  isForbiddenError,
  isUnauthorizedError,
  isNetworkError,
  isRateLimitError,
  isValidationError,
  isServerError,
  isConflictError,
  isServerNotReadyError,
  isFileError,
  isRetryableError,
  isAbortedError,
  isAppError,
  getErrorMessage,
  getValidationIssues,
  getRateLimitInfo,
  getLocalizedErrorMessage,
  ErrorCode,
  ErrorCategory,
};

export type { AppError };

export const getResponseStatus = getErrorStatus;

export const isNotFoundError = _isNotFoundError;
