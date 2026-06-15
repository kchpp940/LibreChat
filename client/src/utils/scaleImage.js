const MAX_HEIGHT_VH = 0.45;
export function scaleImage({ originalWidth, originalHeight, containerRef, }) {
    const container = containerRef.current;
    if (!container) {
        return { width: 'auto', height: 'auto' };
    }
    const containerWidth = container.clientWidth;
    const maxHeight = window.innerHeight * MAX_HEIGHT_VH;
    const aspectRatio = originalWidth / originalHeight;
    let width = Math.min(originalWidth, containerWidth);
    let height = width / aspectRatio;
    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }
    return { width: `${Math.round(width)}px`, height: `${Math.round(height)}px` };
}
