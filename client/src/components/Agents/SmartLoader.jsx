import React, { useState, useEffect } from 'react';
/**
 * SmartLoader - Intelligent loading wrapper that prevents flashing
 *
 * Only shows loading states when:
 * 1. Actually loading AND no existing data
 * 2. Loading has lasted longer than the delay threshold
 *
 * This prevents brief loading flashes for cached/fast responses
 */
export const SmartLoader = ({ isLoading, hasData, delay = 150, loadingComponent, children, className = '', }) => {
    const [shouldShowLoading, setShouldShowLoading] = useState(false);
    useEffect(() => {
        let timeoutId;
        if (isLoading && !hasData) {
            // Only show loading after delay to prevent flashing
            timeoutId = setTimeout(() => {
                setShouldShowLoading(true);
            }, delay);
        }
        else {
            // Immediately hide loading when done
            setShouldShowLoading(false);
        }
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isLoading, hasData, delay]);
    // Show loading state only if we've determined it should be shown
    if (shouldShowLoading) {
        return <div className={className}>{loadingComponent}</div>;
    }
    // Show content (including when loading but we have existing data)
    return <div className={className}>{children}</div>;
};
/**
 * Hook to determine if we have meaningful data to show
 * Helps prevent loading states when we already have cached content
 */
export const useHasData = (data) => {
    if (!data)
        return false;
    // Type guard for object data
    if (typeof data === 'object' && data !== null) {
        // Check for agent list data
        if ('agents' in data) {
            const agents = data.agents;
            return Array.isArray(agents) && agents.length > 0;
        }
        // Check for single agent data
        if ('id' in data || 'name' in data) {
            return true;
        }
    }
    // Check for categories data (array)
    if (Array.isArray(data)) {
        return data.length > 0;
    }
    return false;
};
export default SmartLoader;
