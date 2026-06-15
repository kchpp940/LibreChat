import { useCallback } from 'react';
import useFileHandling, { useFileHandlingNoChatContext } from './useFileHandling';
import useSharePointDownload from './useSharePointDownload';
export default function useSharePointFileHandling(props) {
    const { handleFiles } = useFileHandling(props);
    const { downloadSharePointFiles, isDownloading, downloadProgress, error } = useSharePointDownload({
        onFilesDownloaded: async (downloadedFiles) => {
            const fileArray = Array.from(downloadedFiles);
            await handleFiles(fileArray, props?.toolResource);
        },
        onError: (error) => {
            console.error('SharePoint download failed:', error);
        },
    });
    const handleSharePointFiles = useCallback(async (sharePointFiles) => {
        try {
            await downloadSharePointFiles(sharePointFiles);
        }
        catch (error) {
            console.error('SharePoint file handling error:', error);
            throw error;
        }
    }, [downloadSharePointFiles]);
    return {
        handleSharePointFiles,
        isProcessing: isDownloading,
        downloadProgress,
        error,
    };
}
export function useSharePointFileHandlingNoChatContext(props, fileState) {
    const { handleFiles } = useFileHandlingNoChatContext(props, fileState);
    const { downloadSharePointFiles, isDownloading, downloadProgress, error } = useSharePointDownload({
        onFilesDownloaded: async (downloadedFiles) => {
            const fileArray = Array.from(downloadedFiles);
            await handleFiles(fileArray, props?.toolResource);
        },
        onError: (error) => {
            console.error('SharePoint download failed:', error);
        },
    });
    const handleSharePointFiles = useCallback(async (sharePointFiles) => {
        try {
            await downloadSharePointFiles(sharePointFiles);
        }
        catch (error) {
            console.error('SharePoint file handling error:', error);
            throw error;
        }
    }, [downloadSharePointFiles]);
    return {
        handleSharePointFiles,
        isProcessing: isDownloading,
        downloadProgress,
        error,
    };
}
