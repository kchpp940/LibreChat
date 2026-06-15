import { useMemo } from 'react';
/**
 * Hook to check if a message has parallel content.
 * Returns whether any content part has a groupId.
 *
 * @param message - The message to check
 * @returns ContentMetadataResult with hasParallelContent boolean
 */
export default function useContentMetadata(message) {
    return useMemo(() => {
        const content = message?.content;
        if (!content || !Array.isArray(content)) {
            return { hasParallelContent: false };
        }
        // Check if any content part has a groupId (TMessageContentParts now includes ContentMetadata)
        const hasParallelContent = content.some((part) => part?.groupId != null);
        return { hasParallelContent };
    }, [message?.content]);
}
