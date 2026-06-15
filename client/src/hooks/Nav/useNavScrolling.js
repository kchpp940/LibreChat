import throttle from 'lodash/throttle';
import { useCallback, useEffect, useRef } from 'react';
export default function useNavScrolling({ nextCursor, isFetchingNext, setShowLoading, fetchNextPage, }) {
    const scrollPositionRef = useRef(null);
    const containerRef = useRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchNext = useCallback(throttle(() => {
        if (fetchNextPage) {
            return fetchNextPage();
        }
        return Promise.resolve();
    }, 750, { leading: true }), [fetchNextPage]);
    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
            const nearBottomOfList = scrollTop + clientHeight >= scrollHeight * 0.97;
            if (nearBottomOfList && nextCursor != null && !isFetchingNext) {
                setShowLoading(true);
                fetchNext();
            }
            else {
                setShowLoading(false);
            }
        }
    }, [nextCursor, isFetchingNext, fetchNext, setShowLoading]);
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, [handleScroll]);
    const moveToTop = useCallback(() => {
        const container = containerRef.current;
        if (container) {
            scrollPositionRef.current = container.scrollTop;
        }
    }, []);
    return {
        containerRef,
        moveToTop,
    };
}
