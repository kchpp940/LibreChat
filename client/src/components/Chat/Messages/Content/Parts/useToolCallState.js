import { useState, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { isError } from '~/components/Chat/Messages/Content/ToolOutput';
import { useProgress, useExpandCollapse } from '~/hooks';
import store from '~/store';
export default function useToolCallState(initialProgress, isSubmitting, output, hasInput, onExpand) {
    const autoExpand = useRecoilValue(store.autoExpandTools);
    const hasOutput = output.length > 0;
    const hasError = hasOutput && isError(output);
    const hasContent = hasInput || hasOutput;
    const [showCode, setShowCode] = useState(() => autoExpand && hasContent);
    const { style: expandStyle, ref: expandRef } = useExpandCollapse(showCode);
    useEffect(() => {
        if (autoExpand && hasContent) {
            setShowCode(true);
        }
    }, [autoExpand, hasContent]);
    const progress = useProgress(initialProgress);
    const toggleCode = useCallback(() => {
        setShowCode((prev) => {
            const next = !prev;
            if (next) {
                onExpand?.();
            }
            return next;
        });
    }, [onExpand]);
    const cancelled = !isSubmitting && progress < 1 && !hasError;
    return {
        showCode,
        toggleCode,
        expandStyle,
        expandRef,
        progress,
        cancelled,
        hasError,
        hasOutput,
        hasContent,
    };
}
