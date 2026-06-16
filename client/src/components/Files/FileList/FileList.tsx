import type { PublicFileAssetDescriptor } from 'librechat-data-provider';
import React from 'react';
import FileListItem from './FileListItem';
import FileListItem2 from './FileListItem2';

type FileListProps = {
  files: PublicFileAssetDescriptor[];
  deleteFile: (id: string | undefined) => void;
  attachedVectorStores: { name: string }[];
};

export default function FileList({ files, deleteFile, attachedVectorStores }: FileListProps) {
  return (
    <div className="h-[85vh] overflow-y-auto">
      {files.map((file) => (
        // <FileListItem key={file.file_id} file={file} deleteFile={deleteFile} width="100%" />
        <FileListItem2
          key={file.file_id}
          file={file}
          deleteFile={deleteFile}
          attachedVectorStores={attachedVectorStores}
        />
      ))}
    </div>
  );
}
