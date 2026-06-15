export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  ABORTED = 'ABORTED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED = 'RATE_LIMITED',
  REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  MODEL_RESPONSE_FAILED = 'MODEL_RESPONSE_FAILED',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  MAX_FAVORITES_EXCEEDED = 'MAX_FAVORITES_EXCEEDED',
  MAX_SKILL_FAVORITES_EXCEEDED = 'MAX_SKILL_FAVORITES_EXCEEDED',
  BALANCE_INSUFFICIENT = 'BALANCE_INSUFFICIENT',
  INVALID_API_KEY = 'INVALID_API_KEY',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTH = 'auth',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  SERVER = 'server',
  BUSINESS = 'business',
  FILE = 'file',
  MODEL = 'model',
  UNKNOWN = 'unknown',
}

export interface ValidationIssue {
  field: string;
  message: string;
  code?: string;
}

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  resetAt?: number;
}

export interface AppError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly status?: number;
  readonly message: string;
  readonly userMessage?: string;
  readonly details?: Record<string, unknown>;
  readonly validationIssues?: ValidationIssue[];
  readonly rateLimit?: RateLimitInfo;
  readonly retryable: boolean;
  readonly originalError?: unknown;
  readonly requestId?: string;
  readonly endpoint?: string;
  readonly method?: string;
}

export interface NormalizeErrorOptions {
  endpoint?: string;
  method?: string;
  fallbackMessage?: string;
}

export type ErrorPredicate = (error: unknown) => boolean;

export type LocalizeFunction = (
  key: string,
  options?: Record<string, unknown> | undefined,
) => string;

export type LocalizedMessageFn = (
  error: AppError,
  localize: LocalizeFunction,
) => string;
