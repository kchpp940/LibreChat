import { FileContext } from 'librechat-data-provider';
import type { PublicFileAssetDescriptor } from 'librechat-data-provider';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { useGetFiles } from '~/data-provider';
import { DataTable, columns } from './Table';
import { useLocalize } from '~/hooks';

export function MyFilesModal({
  open,
  onOpenChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | HTMLDivElement | null>;
}) {
  const localize = useLocalize();

  const { data: files = [] } = useGetFiles<PublicFileAssetDescriptor[]>({
    select: (files) =>
      files.map((file) => ({
        ...file,
        context: file.context ?? FileContext.unknown,
      })),
  });

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
      <OGDialogContent
        title={localize('com_nav_my_files')}
        className="w-11/12 bg-background text-text-primary shadow-2xl"
      >
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_nav_my_files')}</OGDialogTitle>
        </OGDialogHeader>
        <DataTable columns={columns} data={files} />
      </OGDialogContent>
    </OGDialog>
  );
}
