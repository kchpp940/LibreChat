import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
export function useCustomLink(route, callback) {
    const navigate = useNavigate();
    const location = useLocation();
    const clickHandler = useCallback((event) => {
        if (callback) {
            callback(event);
        }
        if (event.button === 0 && !(event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            navigate(route, { state: { prevLocation: location } });
        }
    }, [navigate, route, callback, location]);
    return clickHandler;
}
export const usePreviousLocation = () => {
    const location = useLocation();
    const previousLocationRef = useRef();
    useEffect(() => {
        previousLocationRef.current = location.state?.prevLocation;
    }, [location]);
    return previousLocationRef;
};
