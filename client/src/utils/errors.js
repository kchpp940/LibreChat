/**
 * Frontend Error Facade (JS 版)
 *
 *  ⚠️  架构边界提示：业务开发者请从这里导入错误处理 API，
 *      不要直接从 librechat-data-provider 深层路径导入，也
 *      不要自己读 error.response?.status / .data?.code！
 *
 *      违反会被 scripts/check-error-boundary.mjs 扫描脚本拦截。
 *
 *  ── 业务代码推荐写法 ──────────────────────────────────────
 *
 *    import {
 *      normalizeError, isForbiddenError, isNotFoundError,
 *      isRetryableError, getLocalizedErrorMessage,
 *    } from '~/utils/errors';
 *
 *    onError: (rawError) => {
 *      const appError = normalizeError(rawError);
 *      if (isNotFoundError(appError)) { ... }
 *      showToast({ message: getLocalizedErrorMessage(appError, t) });
 *    },
 *
 *  本文件不包含任何实现，全部从 librechat-data-provider 重新导出，
 *  仅为了统一入口 + 提供 TS/JS 双版本 facade。
 *  核心实现：packages/data-provider/src/errors.ts
 */

import {
  normalizeError,
  isNotFoundError,
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
} from 'librechat-data-provider';

export {
  normalizeError,
  isNotFoundError,
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
};

export const getResponseStatus = getErrorStatus;
