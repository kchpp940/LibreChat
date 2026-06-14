import { memo, useState, useEffect, useRef, useLayoutEffect, useId } from 'react';
import { Download } from 'lucide-react';
import type { TAttachment, TFile, TAttachmentMetadata } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { useAttachmentLink } from '../../Parts/LogLink';
import FileContainer from '~/components/Chat/Input/Files/FileContainer';
import { cn } from '~/utils';
import { displayFilename as displayFn } from '../../Parts/attachmentTypes';

function displayFilename(name?: string) {
  return displayFn(name);
}

const COLLAPSED_MAX_HEIGHT = 320;

interface TextAttachmentProps {
  attachment: Partial<TAttachment>;
  showFileChip?: boolean;
}

export default memo(function TextAttachmentComponent({
  attachment,
  showFileChip = true,
}: TextAttachmentProps) {
  const localize = useLocalize();
  const preId = useId();
  const preRef = useRef<HTMLPreElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowed, setOverflowed] = useState(false);
  const file = attachment as TFile & TAttachmentMetadata;
  const { handleDownload } = useAttachmentLink({
    href: attachment.filepath ?? '',
    filename: attachment.filename ?? '',
    file_id: file.file_id,
    user: file.user,
    source: file.source,
  });
  const extension = attachment.filename?.split('.').pop();
  const text = file.text ?? '';
  const visibleFilename = displayFilename(attachment.filename);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    const el = preRef.current;
    if (!el) return;
    setOverflowed(el.scrollHeight > COLLAPSED_MAX_HEIGHT + 1);
  }, [text]);

  const isClamped = overflowed && !expanded;

  return (
    <div
      className={cn(
        'text-attachment-container flex w-full flex-col gap-1.5',
        'transition-all duration-300 ease-out',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
      style={{
        transformOrigin: 'center top',
        willChange: 'opacity, transform',
        WebkitFontSmoothing: 'subpixel-antialiased',
      }}
    >
      {attachment.filepath && showFileChip && (
        <FileContainer
          file={attachment}
          onClick={handleDownload}
          overrideType={extension}
          displayName={displayFilename(attachment.filename)}
          containerClassName="max-w-fit"
          buttonClassName="bg-surface-secondary hover:cursor-pointer hover:bg-surface-hover active:bg-surface-secondary focus:bg-surface-hover hover:border-border-heavy active:border-border-heavy"
        />
      )}
      <div className="overflow-hidden rounded-lg bg-surface-secondary">
        {!showFileChip && (
          <div className="flex items-center justify-between gap-2 border-b border-border-light px-3 py-2">
            <span className="min-w-0 truncate text-sm font-medium" title={visibleFilename}>
              {visibleFilename}
            </span>
            {attachment.filepath && (
              <button
                type="button"
                onClick={handleDownload}
                aria-label={`${localize('com_ui_download')} ${visibleFilename}`}
                title={localize('com_ui_download')}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
              >
                <Download className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="p-4">
          <pre
            id={preId}
            ref={preRef}
            className={cn(
              'whitespace-pre-wrap break-words font-mono text-sm leading-6 text-text-primary',
              isClamped ? 'overflow-hidden' : 'overflow-auto',
            )}
            style={isClamped ? { maxHeight: COLLAPSED_MAX_HEIGHT } : undefined}
          >
            {text}
          </pre>
          {overflowed && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              aria-controls={preId}
              className="mt-2 text-xs text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
            >
              {expanded ? localize('com_ui_collapse') : localize('com_ui_show_all')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
