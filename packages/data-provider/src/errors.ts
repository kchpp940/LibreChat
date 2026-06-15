import axios, { AxiosError } from 'axios';
import type {
  AppError,
  ErrorCode,
  ErrorCategory,
  NormalizeErrorOptions,
  ValidationIssue,
  RateLimitInfo,
  LocalizedMessageFn,
  LocalizeFunction,
} from './types/errors';
import { ErrorCode as EC, ErrorCategory as ECat } from './types/errors';

export type { AppError, ErrorCode, ErrorCategory, NormalizeErrorOptions, ValidationIssue, RateLimitInfo, LocalizedMessageFn, LocalizeFunction, ErrorPredicate } from './types/errors';

class AppErrorImpl extends Error implements AppError {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly status?: number;
  readonly userMessage?: string;
  readonly details?: Record<string, unknown>;
  readonly validationIssues?: ValidationIssue[];
  readonly rateLimit?: RateLimitInfo;
  readonly retryable: boolean;
  readonly originalError?: unknown;
  readonly requestId?: string;
  readonly endpoint?: string;
  readonly method?: string;

  constructor(params: AppError & { message: string }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.category = params.category;
    this.status = params.status;
    this.message = params.message;
    this.userMessage = params.userMessage;
    this.details = params.details;
    this.validationIssues = params.validationIssues;
    this.rateLimit = params.rateLimit;
    this.retryable = params.retryable;
    this.originalError = params.originalError;
    this.requestId = params.requestId;
    this.endpoint = params.endpoint;
    this.method = params.method;

    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(this, AppErrorImpl.prototype);
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    'category' in error &&
    'retryable' in error &&
    (error as { name?: string }).name === 'AppError'
  );
}

const STATUS_TO_CODE: ReadonlyMap<number, { code: ErrorCode; category: ErrorCategory }> = new Map([
  [400, { code: EC.VALIDATION_ERROR, category: ECat.VALIDATION }],
  [401, { code: EC.UNAUTHORIZED, category: ECat.AUTH }],
  [403, { code: EC.FORBIDDEN, category: ECat.PERMISSION }],
  [404, { code: EC.NOT_FOUND, category: ECat.NOT_FOUND }],
  [409, { code: EC.CONFLICT, category: ECat.BUSINESS }],
  [413, { code: EC.REQUEST_TOO_LARGE, category: ECat.VALIDATION }],
  [422, { code: EC.UNPROCESSABLE_ENTITY, category: ECat.VALIDATION }],
  [429, { code: EC.RATE_LIMITED, category: ECat.RATE_LIMIT }],
  [500, { code: EC.SERVER_ERROR, category: ECat.SERVER }],
  [502, { code: EC.BAD_GATEWAY, category: ECat.SERVER }],
  [503, { code: EC.SERVICE_UNAVAILABLE, category: ECat.SERVER }],
]);

const RETRYABLE_CODES: ReadonlySet<ErrorCode> = new Set([
  EC.NETWORK_ERROR,
  EC.TIMEOUT,
  EC.RATE_LIMITED,
  EC.SERVER_ERROR,
  EC.BAD_GATEWAY,
  EC.SERVICE_UNAVAILABLE,
  EC.MODEL_RESPONSE_FAILED,
]);

function classifyByStatus(status: number): { code: ErrorCode; category: ErrorCategory } {
  return STATUS_TO_CODE.get(status) ?? { code: EC.UNKNOWN, category: ECat.UNKNOWN };
}

function extractResponseData(error: AxiosError): {
  message?: string;
  code?: string;
  limit?: number;
  errors?: ValidationIssue[];
  details?: Record<string, unknown>;
  requestId?: string;
} {
  const data = error.response?.data;
  if (data == null || typeof data !== 'object') {
    return {};
  }

  const result: ReturnType<typeof extractResponseData> = {};

  if ('message' in data && typeof (data as { message?: unknown }).message === 'string') {
    result.message = (data as { message: string }).message;
  }

  if ('code' in data && typeof (data as { code?: unknown }).code === 'string') {
    result.code = (data as { code: string }).code;
  }

  if ('limit' in data) {
    const limit = (data as { limit?: unknown }).limit;
    if (typeof limit === 'number') {
      result.limit = limit;
    }
  }

  if ('errors' in data && Array.isArray((data as { errors?: unknown }).errors)) {
    result.errors = (data as { errors: ValidationIssue[] }).errors;
  }

  if ('requestId' in data && typeof (data as { requestId?: unknown }).requestId === 'string') {
    result.requestId = (data as { requestId: string }).requestId;
  }

  const knownKeys = new Set(['message', 'code', 'limit', 'errors', 'requestId']);
  const extraEntries = Object.entries(data).filter(([k]) => !knownKeys.has(k));
  if (extraEntries.length > 0) {
    result.details = Object.fromEntries(extraEntries) as Record<string, unknown>;
  }

  return result;
}

function extractRateLimitHeaders(error: AxiosError): RateLimitInfo | undefined {
  const headers = error.response?.headers;
  if (headers == null) {
    return undefined;
  }

  const info: RateLimitInfo = {};
  let hasInfo = false;

  if (typeof headers['x-ratelimit-limit'] === 'string') {
    info.limit = parseInt(headers['x-ratelimit-limit'], 10);
    hasInfo = true;
  }
  if (typeof headers['x-ratelimit-remaining'] === 'string') {
    info.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    hasInfo = true;
  }
  if (typeof headers['x-ratelimit-reset'] === 'string') {
    info.resetAt = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
    hasInfo = true;
  }

  return hasInfo ? info : undefined;
}

function mapBusinessCode(code: string): {
  code: ErrorCode;
  category: ErrorCategory;
} | null {
  switch (code) {
    case 'CONVERSATION_NOT_FOUND':
      return { code: EC.CONVERSATION_NOT_FOUND, category: ECat.NOT_FOUND };
    case 'SESSION_EXPIRED':
      return { code: EC.SESSION_EXPIRED, category: ECat.AUTH };
    case 'MODEL_RESPONSE_FAILED':
      return { code: EC.MODEL_RESPONSE_FAILED, category: ECat.MODEL };
    case 'FILE_UPLOAD_FAILED':
      return { code: EC.FILE_UPLOAD_FAILED, category: ECat.FILE };
    case 'FILE_TOO_LARGE':
      return { code: EC.FILE_TOO_LARGE, category: ECat.FILE };
    case 'FILE_TYPE_NOT_ALLOWED':
      return { code: EC.FILE_TYPE_NOT_ALLOWED, category: ECat.FILE };
    case 'MAX_FAVORITES_EXCEEDED':
      return { code: EC.MAX_FAVORITES_EXCEEDED, category: ECat.BUSINESS };
    case 'MAX_SKILL_FAVORITES_EXCEEDED':
      return { code: EC.MAX_SKILL_FAVORITES_EXCEEDED, category: ECat.BUSINESS };
    case 'BALANCE_INSUFFICIENT':
      return { code: EC.BALANCE_INSUFFICIENT, category: ECat.BUSINESS };
    case 'INVALID_API_KEY':
      return { code: EC.INVALID_API_KEY, category: ECat.AUTH };
    default:
      return null;
  }
}

function _isAxiosNetworkError(error: AxiosError): boolean {
  return (
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    (!error.response && error.message?.toLowerCase().includes('network'))
  );
}

function _isAxiosTimeoutError(error: AxiosError): boolean {
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.message?.toLowerCase().includes('timeout')
  );
}

function _isAxiosAbortError(error: AxiosError | unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (axios.isAxiosError(error)) {
    return (
      error.code === 'ERR_CANCELED' ||
      (error as { code?: string }).code === 'ECONNABORTED' ||
      (error.cause instanceof DOMException && error.cause.name === 'AbortError')
    );
  }
  return false;
}

export function normalizeError(
  error: unknown,
  options: NormalizeErrorOptions = {},
): AppError {
  if (isAppError(error)) {
    return error;
  }

  const { endpoint, method, fallbackMessage = 'An unexpected error occurred' } = options;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const responseData = extractResponseData(axiosError);
    const status = axiosError.response?.status;

    let code: ErrorCode;
    let category: ErrorCategory;

    if (responseData.code != null) {
      const businessMatch = mapBusinessCode(responseData.code);
      if (businessMatch) {
        code = businessMatch.code;
        category = businessMatch.category;
      } else if (status != null) {
        const statusMatch = classifyByStatus(status);
        code = statusMatch.code;
        category = statusMatch.category;
      } else {
        code = EC.UNKNOWN;
        category = ECat.UNKNOWN;
      }
    } else if (_isAxiosAbortError(axiosError)) {
      code = EC.ABORTED;
      category = ECat.NETWORK;
    } else if (!axiosError.response && _isAxiosTimeoutError(axiosError)) {
      code = EC.TIMEOUT;
      category = ECat.NETWORK;
    } else if (!axiosError.response && _isAxiosNetworkError(axiosError)) {
      code = EC.NETWORK_ERROR;
      category = ECat.NETWORK;
    } else if (status != null) {
      const statusMatch = classifyByStatus(status);
      code = statusMatch.code;
      category = statusMatch.category;
    } else {
      code = EC.UNKNOWN;
      category = ECat.UNKNOWN;
    }

    const message = responseData.message ?? axiosError.message ?? fallbackMessage;
    const userMessage = responseData.message;
    const retryable = RETRYABLE_CODES.has(code);
    const rateLimit = extractRateLimitHeaders(axiosError);
    const validationIssues = responseData.errors;
    const details = responseData.details;
    const requestId = responseData.requestId;

    if (responseData.limit != null) {
      const existingDetails = details ?? {};
      existingDetails['limit'] = responseData.limit;
      return new AppErrorImpl({
        name: 'AppError',
        code,
        category,
        status,
        message,
        userMessage,
        details: existingDetails,
        validationIssues,
        rateLimit,
        retryable,
        originalError: error,
        requestId,
        endpoint,
        method,
      });
    }

    return new AppErrorImpl({
      name: 'AppError',
      code,
      category,
      status,
      message,
      userMessage,
      details,
      validationIssues,
      rateLimit,
      retryable,
      originalError: error,
      requestId,
      endpoint,
      method,
    });
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AppErrorImpl({
      name: 'AppError',
      code: EC.ABORTED,
      category: ECat.NETWORK,
      message: error.message || 'Request was aborted',
      retryable: false,
      originalError: error,
      endpoint,
      method,
    });
  }

  if (error instanceof Error) {
    return new AppErrorImpl({
      name: 'AppError',
      code: EC.UNKNOWN,
      category: ECat.UNKNOWN,
      message: error.message || fallbackMessage,
      retryable: false,
      originalError: error,
      endpoint,
      method,
    });
  }

  return new AppErrorImpl({
    name: 'AppError',
    code: EC.UNKNOWN,
    category: ECat.UNKNOWN,
    message: fallbackMessage,
    retryable: false,
    originalError: error,
    endpoint,
    method,
  });
}

export function isNotFoundError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return (
    appError.code === EC.NOT_FOUND ||
    appError.code === EC.CONVERSATION_NOT_FOUND ||
    appError.status === 404
  );
}

export function isForbiddenError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.code === EC.FORBIDDEN || appError.status === 403;
}

export function isUnauthorizedError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return (
    appError.code === EC.UNAUTHORIZED ||
    appError.code === EC.SESSION_EXPIRED ||
    appError.status === 401
  );
}

export function isNetworkError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return (
    appError.code === EC.NETWORK_ERROR ||
    appError.code === EC.TIMEOUT ||
    appError.category === ECat.NETWORK
  );
}

export function isRateLimitError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.code === EC.RATE_LIMITED || appError.category === ECat.RATE_LIMIT;
}

export function isValidationError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return (
    appError.code === EC.VALIDATION_ERROR ||
    appError.code === EC.UNPROCESSABLE_ENTITY ||
    appError.category === ECat.VALIDATION
  );
}

export function isServerError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.category === ECat.SERVER;
}

export function isFileError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return (
    appError.code === EC.FILE_UPLOAD_FAILED ||
    appError.code === EC.FILE_TOO_LARGE ||
    appError.code === EC.FILE_TYPE_NOT_ALLOWED ||
    appError.category === ECat.FILE
  );
}

export function isRetryableError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.retryable;
}

export function isAbortedError(error: unknown): boolean {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.code === EC.ABORTED;
}

export function getErrorStatus(error: unknown): number | undefined {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.status;
}

export function getErrorMessage(error: unknown, fallback?: string): string {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.userMessage ?? appError.message ?? fallback ?? 'An unexpected error occurred';
}

export function getValidationIssues(error: unknown): ValidationIssue[] {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.validationIssues ?? [];
}

export function getRateLimitInfo(error: unknown): RateLimitInfo | undefined {
  const appError = isAppError(error) ? error : normalizeError(error);
  return appError.rateLimit;
}

export const getLocalizedErrorMessage = (
  error: AppError,
  localize: LocalizeFunction,
): string => {
  switch (error.code) {
    case EC.NETWORK_ERROR:
      return localize('com_ui_network_error');
    case EC.TIMEOUT:
      return localize('com_ui_timeout_error');
    case EC.ABORTED:
      return localize('com_ui_request_cancelled');
    case EC.UNAUTHORIZED:
    case EC.SESSION_EXPIRED:
      return localize('com_ui_session_expired');
    case EC.FORBIDDEN:
      return localize('com_ui_delete_not_allowed') || localize('com_ui_forbidden');
    case EC.NOT_FOUND:
      return localize('com_ui_not_found');
    case EC.CONVERSATION_NOT_FOUND:
      return localize('com_ui_conversation_not_found');
    case EC.CONFLICT:
      return localize('com_ui_conflict_error');
    case EC.VALIDATION_ERROR:
    case EC.UNPROCESSABLE_ENTITY:
      return localize('com_ui_validation_error');
    case EC.RATE_LIMITED:
      return localize('com_ui_rate_limited');
    case EC.REQUEST_TOO_LARGE:
      return localize('com_ui_request_too_large');
    case EC.SERVER_ERROR:
    case EC.BAD_GATEWAY:
    case EC.SERVICE_UNAVAILABLE:
      return localize('com_ui_server_error');
    case EC.MODEL_RESPONSE_FAILED:
      return localize('com_ui_model_response_failed');
    case EC.FILE_UPLOAD_FAILED:
      return localize('com_ui_file_upload_failed');
    case EC.FILE_TOO_LARGE:
      return localize('com_ui_file_too_large');
    case EC.FILE_TYPE_NOT_ALLOWED:
      return localize('com_ui_file_type_not_allowed');
    case EC.MAX_FAVORITES_EXCEEDED:
    case EC.MAX_SKILL_FAVORITES_EXCEEDED: {
      const limit = error.details?.['limit'] as number | undefined;
      return localize('com_ui_max_favorites_reached', {
        0: String(limit ?? 50),
      });
    }
    case EC.BALANCE_INSUFFICIENT:
      return localize('com_ui_balance_insufficient');
    case EC.INVALID_API_KEY:
      return localize('com_ui_invalid_api_key');
    default:
      return error.userMessage ?? localize('com_ui_error');
  }
};
