export const isHttpDownloadTarget = (target) => /^https?:\/\//i.test(target ?? '');
export function triggerDownload(target, filename) {
    const isBlob = target.startsWith('blob:');
    const link = document.createElement('a');
    link.href = target;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (isBlob) {
        setTimeout(() => URL.revokeObjectURL(target), 1000);
    }
}
