import React from 'react';
import FileListItem2 from './FileListItem2';
export default function FileList({ files, deleteFile, attachedVectorStores }) {
    return (<div className="h-[85vh] overflow-y-auto">
      {files.map((file) => (
        // <FileListItem key={file._id} file={file} deleteFile={deleteFile} width="100%" />
        <FileListItem2 key={file._id} file={file} deleteFile={deleteFile} attachedVectorStores={attachedVectorStores}/>))}
    </div>);
}
