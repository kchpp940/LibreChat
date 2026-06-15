import debounce from 'lodash/debounce';
import { FileSources, removeNullishValues } from 'librechat-data-provider';
import { useCallback, useState, useEffect } from 'react';
import useSetFilesToDelete from './useSetFilesToDelete';
import { deletePreview } from '~/utils';
const useFileDeletion = ({ mutateAsync, agent_id, assistant_id, tool_resource, }) => {
    const [_batch, setFileDeleteBatch] = useState([]);
    const setFilesToDelete = useSetFilesToDelete();
    const executeBatchDelete = useCallback(({ filesToDelete, agent_id, assistant_id, tool_resource, }) => {
        const payload = removeNullishValues({
            agent_id,
            assistant_id,
            tool_resource,
        });
        console.log('Deleting files:', filesToDelete, payload);
        mutateAsync({ files: filesToDelete, ...payload });
        setFileDeleteBatch([]);
    }, [mutateAsync]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedDelete = useCallback(debounce(executeBatchDelete, 1000), []);
    useEffect(() => {
        // Cleanup function for debouncedDelete when component unmounts or before re-render
        return () => debouncedDelete.cancel();
    }, [debouncedDelete]);
    const deleteFile = useCallback(({ file: _file, setFiles }) => {
        const { file_id, temp_file_id = '', filepath = '', source = FileSources.local, embedded, attached = false, } = _file;
        const progress = _file['progress'] ?? 1;
        if (progress < 1) {
            return;
        }
        const file = {
            file_id,
            embedded,
            filepath,
            source,
        };
        if (setFiles) {
            setFiles((currentFiles) => {
                const updatedFiles = new Map(currentFiles);
                updatedFiles.delete(file_id);
                updatedFiles.delete(temp_file_id);
                const files = Object.fromEntries(updatedFiles);
                setFilesToDelete(files);
                return updatedFiles;
            });
        }
        deletePreview(file_id);
        if (temp_file_id) {
            deletePreview(temp_file_id);
        }
        if (attached) {
            return;
        }
        setFileDeleteBatch((prevBatch) => {
            const newBatch = [...prevBatch, file];
            debouncedDelete({
                filesToDelete: newBatch,
                agent_id,
                assistant_id,
                tool_resource,
            });
            return newBatch;
        });
    }, [debouncedDelete, setFilesToDelete, agent_id, assistant_id, tool_resource]);
    const deleteFiles = useCallback(({ files, setFiles }) => {
        const batchFiles = [];
        for (const _file of files) {
            const { file_id, embedded, temp_file_id, filepath = '', source = FileSources.local, } = _file;
            batchFiles.push({
                source,
                file_id,
                filepath,
                temp_file_id,
                embedded: embedded ?? false,
            });
            deletePreview(file_id);
            if (temp_file_id) {
                deletePreview(temp_file_id);
            }
        }
        if (setFiles) {
            setFiles((currentFiles) => {
                const updatedFiles = new Map(currentFiles);
                batchFiles.forEach((file) => {
                    updatedFiles.delete(file.file_id);
                    if (file.temp_file_id) {
                        updatedFiles.delete(file.temp_file_id);
                    }
                });
                const filesToUpdate = Object.fromEntries(updatedFiles);
                setFilesToDelete(filesToUpdate);
                return updatedFiles;
            });
        }
        setFileDeleteBatch((prevBatch) => {
            const newBatch = [...prevBatch, ...batchFiles];
            debouncedDelete({
                filesToDelete: newBatch,
                agent_id,
                assistant_id,
            });
            return newBatch;
        });
    }, [debouncedDelete, setFilesToDelete, agent_id, assistant_id]);
    return { deleteFile, deleteFiles };
};
export default useFileDeletion;
