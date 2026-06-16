import { Spinner, FileIcon } from '@librechat/client';
import type { PublicFileAssetDescriptor } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { cn } from '~/utils';

const FilePreview = ({
  file,
  fileType,
  className = '',
}: {
  file?: Partial<ExtendedFile | PublicFileAssetDescriptor>;
  fileType: {
    paths: React.FC;
    fill: string;
    title: string;
  };
  className?: string;
}) => {
  return (
    <div className={cn('relative size-10 shrink-0 overflow-hidden rounded-xl', className)}>
      <FileIcon file={file} fileType={fileType} />
      {typeof file?.['progress'] === 'number' && file?.['progress'] < 1 && (
        <Spinner
          bgOpacity={0.2}
          color="white"
          className="absolute inset-0 m-2.5 flex items-center justify-center"
        />
      )}
    </div>
  );
};

export default FilePreview;
