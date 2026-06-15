import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { useDeleteFilesMutation } from '~/data-provider';
import useFileDeletion from './useFileDeletion';
export default function useDeleteFilesFromTable(callback) {
    const queryClient = useQueryClient();
    const deletionMutation = useDeleteFilesMutation({
        onMutate: async (variables) => {
            const { files } = variables;
            if (!files.length) {
                return new Map();
            }
            const filesToDeleteMap = files.reduce((map, file) => {
                map.set(file.file_id, file);
                return map;
            }, new Map());
            return { filesToDeleteMap };
        },
        onSuccess: (data, variables, context) => {
            console.log('Files deleted');
            const { filesToDeleteMap } = context;
            queryClient.setQueryData([QueryKeys.files], (oldFiles) => {
                const { files } = variables;
                return files.length
                    ? oldFiles?.filter((file) => !filesToDeleteMap.has(file.file_id))
                    : oldFiles;
            });
            callback?.();
        },
        onError: (error) => {
            console.log('Error deleting files:', error);
            callback?.();
        },
    });
    return useFileDeletion({ mutateAsync: deletionMutation.mutateAsync });
}
