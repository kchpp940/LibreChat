export const REDIRECT_PARAM = 'redirect_to';
export const SESSION_KEY = 'post_login_redirect_to';
/** Matches `/login` as a full path segment, with optional basename prefix (e.g. `/librechat/login/2fa`) */
const LOGIN_PATH_RE = /(?:^|\/)login(?:\/|$)/;
/** Validates that a redirect target is a safe relative path (not an absolute or protocol-relative URL) */
export function isSafeRedirect(url) {
    if (!url.startsWith('/') || url.startsWith('//')) {
        return false;
    }
    const path = url.split('?')[0].split('#')[0];
    return !LOGIN_PATH_RE.test(path);
}
/**
 * Resolves the post-login redirect from URL params and sessionStorage,
 * cleans up both sources, and returns the validated target (or null).
 */
export function getPostLoginRedirect(searchParams) {
    const urlRedirect = searchParams.get(REDIRECT_PARAM);
    const storedRedirect = sessionStorage.getItem(SESSION_KEY);
    const target = urlRedirect ?? storedRedirect;
    if (storedRedirect) {
        sessionStorage.removeItem(SESSION_KEY);
    }
    if (target == null || !isSafeRedirect(target)) {
        return null;
    }
    return target;
}
export function persistRedirectToSession(value) {
    if (isSafeRedirect(value)) {
        sessionStorage.setItem(SESSION_KEY, value);
    }
}
