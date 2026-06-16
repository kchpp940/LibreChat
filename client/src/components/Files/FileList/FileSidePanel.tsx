import React from 'react';
import FileList from './FileList';
import { Button, Input } from '@librechat/client';
import { PublicFileAssetDescriptor } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import UploadFileButton from './UploadFileButton';
import { ListFilter } from 'lucide-react';
import { useLocalize } from '~/hooks';

const fakeFiles: PublicFileAssetDescriptor[] = [
  {
    filename: 'File1.jpg',
    bytes: 10000,
    createdAt: '2022-01-01T10:00:00',
    file_id: '1',
    type: 'image/jpeg',
    url: '/files/1',
    embedded: false,
  },
  {
    filename: 'File2.jpg',
    bytes: 15000,
    createdAt: '2022-01-02T15:30:00',
    file_id: '2',
    type: 'image/jpeg',
    url: '/files/2',
    embedded: false,
  },
  {
    filename: 'File3.jpg',
    bytes: 20000,
    createdAt: '2022-01-03T09:45:00',
    file_id: '3',
    type: 'image/jpeg',
    url: '/files/3',
    embedded: false,
  },
];

const attachedVectorStores = [
  { name: 'VectorStore1' },
  { name: 'VectorStore2' },
  { name: 'VectorStore3' },
  { name: 'VectorStore3' },
  { name: 'VectorStore3' },
  { name: 'VectorStore3' },
  { name: 'VectorStore3' },
  { name: 'VectorStore3' },
  { name: 'VectorStore3' },
];

export default function FileSidePanel() {
  const localize = useLocalize();
  const deleteFile = (id: string | undefined) => {
    // Define delete functionality here
    console.log(`Deleting File with id: ${id}`);
  };

  return (
    <div className="w-30">
      <h2 className="m-3 text-lg">
        <strong>{localize('com_ui_files')}</strong>
      </h2>
      <div className="m-3 mt-2 flex w-full flex-row justify-between gap-x-2 lg:m-0">
        <div className="flex w-2/3 flex-row">
          <Button variant="ghost" className="m-0 mr-2 p-0">
            <ListFilter className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Input
            placeholder={localize('com_files_filter')}
            value={''}
            onChange={() => {
              console.log('changed');
            }}
            className="max-w-sm border-border-light placeholder:text-text-secondary"
          />
        </div>
        <div className="w-1/3">
          <UploadFileButton
            onClick={() => {
              console.log('Upload');
            }}
          />
        </div>
      </div>
      <div className="mt-3">
        <FileList
          files={fakeFiles as unknown as TFile[]}
          deleteFile={deleteFile}
          attachedVectorStores={attachedVectorStores}
        />
      </div>
    </div>
  );
}
