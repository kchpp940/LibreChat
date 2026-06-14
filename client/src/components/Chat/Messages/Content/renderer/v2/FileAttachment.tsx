import { memo, useState, useEffect } from 'react';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import type { TAttachment, TFile, TAttachmentMetadata } from 'librechat-data-provider';
import FilePreview from '~/components/Chat/Input/Files/FilePreview';
import FileContainer from '~/components/Chat/Input/Files/FileContainer';
import { useAttachmentLink } from '../../Parts/LogLink';
import { useAttachmentPreviewSync } from '~/hooks';
import { useLocalize } from '~/hooks';
import { cn, getFileType } from '~/utils';
import { displayFilename as displayFn } from '../../Parts/attachmentTypes';

function displayFilename(name?: string) {
  return displayFn(name);
}

interface PreviewPlaceholderProps {
  attachment: Partial<TAttachment>;
  status: 'pending' | 'failed';
  previewError?: string;
}

const PreviewPlaceholderCard = memo(function PreviewPlaceholderCard({
  attachment,
  status,
  previewError,
}: PreviewPlaceholderProps) {
  const localize = useLocalize();
  const file = attachment as TFile & TAttachmentMetadata;
  const { handleDownload } = useAttachmentLink({
    href: attachment.filepath ?? '',
    filename: attachment.filename ?? '',
    file_id: file.file_id,
    user: file.user,
    source: file.source,
  });
  const fileType = getFileType('artifact');
  const visibleFilename = displayFilename(attachment.filename);
  const subtitleText =
    status === 'pending'
      ? localize('com_ui_preview_preparing')
      : localize('com_ui_preview_failed');
  return (
    <div className="group relative my-2 inline-flex max-w-fit items-stretch gap-px overflow-hidden rounded-xl text-sm text-text-primary shadow-sm">
      <div
        aria-disabled="true"
        aria-busy={status === 'pending'}
        className="relative overflow-hidden rounded-l-xl border-border-light bg-surface-tertiary"
        title={status === 'failed' ? (previewError ?? subtitleText) : undefined}
      >
        <div className="w-fit p-2">
          <div className="flex flex-row items-center gap-2">
            <FilePreview fileType={fileType} className="relative" />
            <div className="overflow-hidden text-left">
              <div className="truncate font-medium" title={visibleFilename}>
                {visibleFilename}
              </div>
              <div className="flex items-center gap-1.5 truncate text-xs text-text-secondary">
                {status === 'pending' ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{subtitleText}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        aria-label={`${localize('com_ui_download')} ${visibleFilename}`}
        title={localize('com_ui_download')}
        className={cn(
          'flex shrink-0 items-center justify-center px-3 transition-colors duration-200',
          'rounded-r-xl bg-surface-tertiary text-text-secondary hover:bg-surface-hover hover:text-text-primary',
          'border-l border-border-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
        )}
      >
        <Download className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
});

interface FileAttachmentProps {
  attachment: Partial<TAttachment>;
}

export default memo(function FileAttachment({ attachment }: FileAttachmentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const file = attachment as TFile & TAttachmentMetadata;
  const { handleDownload } = useAttachmentLink({
    href: attachment.filepath ?? '',
    filename: attachment.filename ?? '',
    file_id: file.file_id,
    user: file.user,
    source: file.source,
  });
  const extension = attachment.filename?.split('.').pop();
  const { status: previewStatus, previewError } = useAttachmentPreviewSync(
    attachment as TAttachment,
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (!attachment.filepath) {
    return null;
  }
  if (previewStatus === 'pending' || previewStatus === 'failed') {
    return (
      <div
        className={cn(
          'file-attachment-container',
          'transition-all duration-300 ease-out',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        )}
        style={{
          transformOrigin: 'center top',
          willChange: 'opacity, transform',
          WebkitFontSmoothing: 'subpixel-antialiased',
        }}
      >
        <PreviewPlaceholderCard
          attachment={attachment}
          status={previewStatus}
          previewError={previewError}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        'file-attachment-container',
        'transition-all duration-300 ease-out',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
      style={{
        transformOrigin: 'center top',
        willChange: 'opacity, transform',
        WebkitFontSmoothing: 'subpixel-antialiased',
      }}
    >
      <FileContainer
        file={attachment}
        onClick={handleDownload}
        overrideType={extension}
        displayName={displayFilename(attachment.filename)}
        containerClassName="max-w-fit"
        buttonClassName="bg-surface-secondary hover:cursor-pointer hover:bg-surface-hover active:bg-surface-secondary focus:bg-surface-hover hover:border-border-heavy active:border-border-heavy"
      />
    </div>
  );
});
