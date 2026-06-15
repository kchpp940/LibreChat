export function isImageURL(iconURL) {
    if (!iconURL) {
        return false;
    }
    return /^https?:\/\//i.test(iconURL) || (iconURL.startsWith('/') && !iconURL.startsWith('//'));
}
