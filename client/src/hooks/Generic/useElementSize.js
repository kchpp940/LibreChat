import { useCallback, useLayoutEffect, useState } from 'react';
/**
 * Tracks an element's content-box size via ResizeObserver. Returns a callback
 * ref so conditionally rendered elements are re-observed when they remount.
 */
export default function useElementSize() {
    const [node, setNode] = useState(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const ref = useCallback((element) => setNode(element), []);
    useLayoutEffect(() => {
        if (!node) {
            return;
        }
        const apply = (width, height) => setSize((prev) => prev.width === width && prev.height === height ? prev : { width, height });
        const measure = () => apply(node.offsetWidth, node.offsetHeight);
        measure();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }
        const observer = new ResizeObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) {
                return;
            }
            apply(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height));
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [node]);
    return { ref, width: size.width, height: size.height };
}
