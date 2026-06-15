import React from 'react';
import { FileSources } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useCodeOutputDownload, useFileDownload } from '~/data-provider';
import { isHttpDownloadTarget, triggerDownload } from '~/utils';
/**
 * Determines if a file is stored locally (not an external API URL).
 * Files with these sources are stored on the LibreChat server and should
 * use the /api/files/download endpoint instead of direct URL access.
 */
const isLocallyStoredSource = (source) => {
    if (!source) {
        return false;
    }
    return [
        FileSources.local,
        FileSources.firebase,
        FileSources.s3,
        FileSources.cloudfront,
        FileSources.azure_blob,
    ].includes(source);
};
export const useAttachmentLink = ({ href, filename, file_id, user, source, }) => {
    const { showToast } = useToastContext();
    const useLocalDownload = isLocallyStoredSource(source) && !!file_id && !!user;
    const { refetch: downloadFromApi } = useFileDownload(user, file_id, { source });
    const { refetch: downloadFromUrl } = useCodeOutputDownload(href);
    const handleDownload = async (event) => {
        event.preventDefault();
        try {
            if (!useLocalDownload && isHttpDownloadTarget(href)) {
                triggerDownload(href, filename);
                return;
            }
            const stream = useLocalDownload ? await downloadFromApi() : await downloadFromUrl();
            if (stream.data == null || stream.data === '') {
                console.error('Error downloading file: No data found');
                showToast({
                    status: 'error',
                    message: 'Error downloading file',
                });
                return;
            }
            triggerDownload(stream.data, filename);
        }
        catch (error) {
            console.error('Error downloading file:', error);
        }
    };
    return { handleDownload };
};
const LogLink = ({ href, filename, file_id, user, source, children }) => {
    const { handleDownload } = useAttachmentLink({ href, filename, file_id, user, source });
    return (<a href={href} onClick={handleDownload} target="_blank" rel="noopener noreferrer" className="!text-blue-400 visited:!text-purple-400 hover:underline">
      {children}
    </a>);
};
export default LogLink;
