import axios from 'axios';
/**
 * Returns the HTTP response status code from an error, regardless of the
 * HTTP client used.  Handles Axios errors first, then falls back to checking
 * for a plain `status` property so callers never need to import axios.
 */
export const getResponseStatus = (error) => {
    if (axios.isAxiosError(error)) {
        return error.response?.status;
    }
    if (error != null && typeof error === 'object' && 'status' in error) {
        const { status } = error;
        if (typeof status === 'number') {
            return status;
        }
    }
    return undefined;
};
export const isNotFoundError = (error) => getResponseStatus(error) === 404;
