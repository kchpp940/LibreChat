import { useEffect, useMemo } from 'react';
import { useToastContext } from '@librechat/client';
import { EToolResources, FileIndexingStatus } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { useDeleteFilesMutation } from '~/data-provider';
import { logger, getCachedPreview } from '~/utils';
import { useFileDeletion } from '~/hooks/Files';
import FileContainer from './FileContainer';
import { useLocalize } from '~/hooks';
import Image from './Image';

export default function FileRow({
  files: _files,
  setFiles,
  abortUpload,
  setFilesLoading,
  assistant_id,
  agent_id,
  tool_resource,
  fileFilter,
  isRTL = false,
  Wrapper,
}: {
  files: Map<string, ExtendedFile> | undefined;
  abortUpload?: () => void;
  setFiles: React.Dispatch<React.SetStateAction<Map<string, ExtendedFile>>>;
  setFilesLoading?: React.Dispatch<React.SetStateAction<boolean>>;
  fileFilter?: (file: ExtendedFile) => boolean;
  assistant_id?: string;
  agent_id?: string;
  tool_resource?: EToolResources;
  isRTL?: boolean;
  Wrapper?: React.FC<{ children: React.ReactNode }>;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const files = Array.from(_files?.values() ?? []).filter((file) =>
    fileFilter ? fileFilter(file) : true,
  );

  const { mutateAsync } = useDeleteFilesMutation({
    onMutate: async () =>
      logger.log(
        'agents',
        'Deleting files: agent_id, assistant_id, tool_resource',
        agent_id,
        assistant_id,
        tool_resource,
      ),
    onSuccess: () => {
      console.log('Files deleted');
    },
    onError: (error) => {
      console.log('Error deleting files:', error);
    },
  });

  const { deleteFile } = useFileDeletion({ mutateAsync, agent_id, assistant_id, tool_resource });

  const isFileProcessing = (file: ExtendedFile): boolean => {
    if (file.progress < 1) return true;
    return file.indexingStatus === FileIndexingStatus.PENDING;
  };

  useEffect(() => {
    if (!setFilesLoading) return;
    if (files.length === 0) {
      setFilesLoading(false);
      return;
    }

    if (files.some(isFileProcessing)) {
      setFilesLoading(true);
      return;
    }

    if (files.every((file) => !isFileProcessing(file))) {
      setFilesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  if (files.length === 0) {
    return null;
  }

  const getFileSubtitle = (file: ExtendedFile): React.ReactNode => {
    if (file.progress < 1) {
      return undefined;
    }
    if (file.indexingStatus === FileIndexingStatus.PENDING) {
      return (
        <div className="truncate text-amber-500" title={localize('com_ui_file_indexing')}>
          {localize('com_ui_file_indexing')}
        </div>
      );
    }
    if (file.indexingStatus === FileIndexingStatus.FAILED) {
      return (
        <div className="truncate text-red-500" title={localize('com_ui_file_index_failed')}>
          {localize('com_ui_file_index_failed')}
        </div>
      );
    }
    if (file.indexingStatus === FileIndexingStatus.INDEXED) {
      return (
        <div className="truncate text-green-500" title={localize('com_ui_file_searchable')}>
          {localize('com_ui_file_searchable')}
        </div>
      );
    }
    return undefined;
  };

  const renderFiles = () => {
    const rowStyle = isRTL
      ? {
          display: 'flex',
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: '4px',
          width: '100%',
          maxWidth: '100%',
        }
      : {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          width: '100%',
          maxWidth: '100%',
        };

    return (
      <div style={rowStyle as React.CSSProperties}>
        {files
          .reduce(
            (acc, current) => {
              if (!acc.map.has(current.file_id)) {
                acc.map.set(current.file_id, true);
                acc.uniqueFiles.push(current);
              }
              return acc;
            },
            { map: new Map(), uniqueFiles: [] as ExtendedFile[] },
          )
          .uniqueFiles.map((file: ExtendedFile, index: number) => {
            const handleDelete = () => {
              if (abortUpload && isFileProcessing(file)) {
                abortUpload();
              }
              if (!isFileProcessing(file) && !file.attached) {
                showToast({
                  message: localize('com_ui_deleting_file'),
                  status: 'info',
                });
              }
              deleteFile({ file, setFiles });
            };
            const isImage = file.type?.startsWith('image') ?? false;
            const subtitle = getFileSubtitle(file);

            return (
              <div
                key={index}
                style={{
                  flexBasis: '70px',
                  flexGrow: 0,
                  flexShrink: 0,
                }}
              >
                {isImage ? (
                  <Image
                    url={getCachedPreview(file.file_id) ?? file.preview ?? file.filepath}
                    onDelete={handleDelete}
                    progress={file.progress}
                    source={file.source}
                  />
                ) : (
                  <FileContainer file={file} onDelete={handleDelete} subtitle={subtitle} />
                )}
              </div>
            );
          })}
      </div>
    );
  };

  if (Wrapper) {
    return <Wrapper>{renderFiles()}</Wrapper>;
  }

  return renderFiles();
}
