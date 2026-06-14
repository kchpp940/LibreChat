import { memo, useState, useMemo, useEffect, useRef, useId, useLayoutEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Download, ChevronDown, Files as FilesIcon } from 'lucide-react';
import { Tools } from 'librechat-data-provider';
import type { TAttachment, TFile, TAttachmentMetadata } from 'librechat-data-provider';
import type { ToolArtifactType } from '~/utils/artifacts';
import {
  artifactTypeForAttachment,
  bySalience,
  byEntrySalience,
  displayFilename,
  isImageAttachment,
  isInternalSandboxArtifact,
  isTextAttachment,
  renderAttachmentKey,
} from '../Parts/attachmentTypes';
import FilePreview from '~/components/Chat/Input/Files/FilePreview';
import FileContainer from '~/components/Chat/Input/Files/FileContainer';
import { fileToArtifact, TOOL_ARTIFACT_TYPES } from '~/utils/artifacts';
import Image from '../Image';
import ToolMermaidArtifact from '../Parts/ToolMermaidArtifact';
import ToolArtifactCard from '../Parts/ToolArtifactCard';
import { useAttachmentLink } from '../Parts/LogLink';
import { useLocalize, useAttachmentPreviewSync, useExpandCollapse } from '~/hooks';
import { cn, getFileType } from '~/utils';
import type { AttachmentRenderer, AttachmentRendererProps } from './types';

const COLLAPSED_MAX_HEIGHT = 320;

const PreviewPlaceholderCard = memo(
  ({
    attachment,
    status,
    previewError,
  }: {
    attachment: Partial<TAttachment>;
    status: 'pending' | 'failed';
    previewError?: string;
  }) => {
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
  },
);
PreviewPlaceholderCard.displayName = 'PreviewPlaceholderCard';

const FileAttachment = memo(({ attachment }: { attachment: Partial<TAttachment> }) => {
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

const FileAttachmentGroup = memo(({ attachments }: { attachments: TAttachment[] }) => {
  const localize = useLocalize();
  const panelId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const { style: expandStyle, ref: expandRef } = useExpandCollapse(isExpanded);
  const visibleAttachments = useMemo(
    () => attachments.filter((attachment) => Boolean(attachment.filepath)),
    [attachments],
  );
  const count = visibleAttachments.length;
  const summary = useMemo(() => {
    const names = visibleAttachments.map((attachment) => displayFilename(attachment.filename));
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} ${localize('com_ui_plus_n_more', {
      0: String(names.length - 2),
    })}`;
  }, [visibleAttachments, localize]);
  const groupedAttachments = useMemo(() => {
    const files: TAttachment[] = [];
    const textPreviews: TAttachment[] = [];
    for (const attachment of visibleAttachments) {
      if (isTextAttachment(attachment)) {
        textPreviews.push(attachment);
        continue;
      }
      files.push(attachment);
    }
    return { files, textPreviews };
  }, [visibleAttachments]);

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    const [attachment] = visibleAttachments;
    if (!attachment) {
      return null;
    }
    return (
      <div className="my-2 flex flex-wrap items-center gap-2.5">
        <FileAttachment attachment={attachment} key={renderAttachmentKey('file', attachment, 0)} />
      </div>
    );
  }

  const fileCount = localize('com_ui_n_files', { 0: String(count) });
  const buttonLabel = isExpanded
    ? localize('com_ui_hide_n_files', { 0: String(count) })
    : localize('com_ui_show_n_files', { 0: String(count) });

  return (
    <div className="my-2 w-full max-w-full">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={buttonLabel}
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          'inline-flex w-full max-w-full items-center gap-2 rounded-lg py-1 pr-2 text-sm',
          'text-text-secondary transition-colors hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
        )}
      >
        <FilesIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="shrink-0 font-medium">{fileCount}</span>
        {summary.length > 0 && (
          <span className="min-w-0 truncate text-left text-xs font-normal" title={summary}>
            {'— '}
            {summary}
          </span>
        )}
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 transition-transform duration-200 ease-out',
            isExpanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <div id={panelId} style={expandStyle}>
        <div className="overflow-hidden" ref={expandRef} aria-hidden={!isExpanded}>
          <div className="flex flex-col gap-2.5 pt-2">
            {groupedAttachments.files.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5">
                {groupedAttachments.files.map((attachment, index) => (
                  <FileAttachment
                    attachment={attachment}
                    key={renderAttachmentKey('file', attachment, index)}
                  />
                ))}
              </div>
            )}
            {groupedAttachments.textPreviews.map((attachment, index) => (
              <TextAttachmentComponent
                attachment={attachment}
                showFileChip={false}
                key={renderAttachmentKey('text', attachment, index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
FileAttachmentGroup.displayName = 'FileAttachmentGroup';

const TextAttachmentComponent = memo(
  ({
    attachment,
    showFileChip = true,
  }: {
    attachment: Partial<TAttachment>;
    showFileChip?: boolean;
  }) => {
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
      if (!el) {
        return;
      }
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
  },
);

const ImageAttachment = memo(({ attachment }: { attachment: TAttachment }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { width, height, filepath = null } = attachment as TFile & TAttachmentMetadata;

  useEffect(() => {
    setIsLoaded(false);
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, [attachment]);

  return (
    <div
      className={cn(
        'image-attachment-container',
        'transition-all duration-500 ease-out',
        isLoaded ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-0',
      )}
      style={{
        transformOrigin: 'center top',
        willChange: 'opacity, transform',
        WebkitFontSmoothing: 'subpixel-antialiased',
      }}
    >
      <Image
        altText={attachment.filename || 'attachment image'}
        imagePath={filepath ?? ''}
        width={width}
        height={height}
        className="mb-4"
      />
    </div>
  );
});

const PanelArtifact = memo(
  ({ attachment, type }: { attachment: TAttachment; type: ToolArtifactType }) => {
    const localize = useLocalize();
    const placeholder = localize('com_ui_artifact_preview_pending');
    const artifact = useMemo(
      () =>
        fileToArtifact(attachment as TFile & TAttachmentMetadata, {
          placeholder,
          preClassifiedType: type,
        }),
      [attachment, type, placeholder],
    );
    if (!artifact) {
      return null;
    }
    return <ToolArtifactCard attachment={attachment} artifact={artifact} />;
  },
);
PanelArtifact.displayName = 'PanelArtifact';

const MermaidArtifact = memo(({ attachment }: { attachment: TAttachment }) => {
  const file = attachment as TFile & TAttachmentMetadata;
  if (!file.text) {
    return null;
  }
  return <ToolMermaidArtifact attachment={attachment} text={file.text} />;
});
MermaidArtifact.displayName = 'MermaidArtifact';

const GenericFileRenderer = memo(function GenericFileRenderer(props: AttachmentRendererProps) {
  const { attachment } = props;
  if (!attachment.filepath) {
    return null;
  }
  return <FileAttachment attachment={attachment} />;
});

export const attachmentRenderers: AttachmentRenderer[] = [
  {
    id: 'attachment-web-search-skip',
    name: 'Web Search Attachment Skip',
    priority: 1000,
    skip: (attachment: TAttachment) => attachment.type === Tools.web_search,
    match: (attachment: TAttachment) => ({ matched: attachment.type === Tools.web_search }),
    render: memo(function SkipRenderer() {
      return null;
    }),
  },
  {
    id: 'attachment-sandbox-skip',
    name: 'Sandbox Internal Artifact Skip',
    priority: 999,
    skip: (attachment: TAttachment) => isInternalSandboxArtifact(attachment),
    match: (attachment: TAttachment) => ({ matched: isInternalSandboxArtifact(attachment) }),
    render: memo(function SkipRenderer() {
      return null;
    }),
  },
  {
    id: 'attachment-image',
    name: 'Image Attachment',
    priority: 200,
    match: (attachment: TAttachment) => ({ matched: isImageAttachment(attachment) }),
    render: memo(function ImageRenderer(props: AttachmentRendererProps) {
      return <ImageAttachment attachment={props.attachment} />;
    }),
  },
  {
    id: 'attachment-mermaid',
    name: 'Mermaid Artifact',
    priority: 180,
    match: (attachment: TAttachment) => ({
      matched: artifactTypeForAttachment(attachment) === TOOL_ARTIFACT_TYPES.MERMAID,
    }),
    render: memo(function MermaidRenderer(props: AttachmentRendererProps) {
      return <MermaidArtifact attachment={props.attachment} />;
    }),
  },
  {
    id: 'attachment-panel-artifact',
    name: 'Panel Artifact (Spreadsheet, PDF, etc.)',
    priority: 170,
    match: (attachment: TAttachment) => ({
      matched: artifactTypeForAttachment(attachment) != null,
    }),
    render: memo(function PanelArtifactRenderer(props: AttachmentRendererProps) {
      const artType = artifactTypeForAttachment(props.attachment);
      if (artType == null) {
        return null;
      }
      return <PanelArtifact attachment={props.attachment} type={artType} />;
    }),
  },
  {
    id: 'attachment-text',
    name: 'Text Attachment (Inline)',
    priority: 150,
    match: (attachment: TAttachment) => ({ matched: isTextAttachment(attachment) }),
    render: memo(function TextRenderer(props: AttachmentRendererProps) {
      return <TextAttachmentComponent attachment={props.attachment} />;
    }),
  },
  {
    id: 'attachment-file',
    name: 'Generic File Download (Fallback)',
    priority: 0,
    match: (attachment: TAttachment) => ({ matched: Boolean(attachment.filepath) }),
    render: GenericFileRenderer,
  },
];

export interface AttachmentGroupBuckets {
  fileAttachments: TAttachment[];
  imageAttachments: TAttachment[];
  textAttachments: TAttachment[];
  panelRow: Array<{ attachment: TAttachment; type: ToolArtifactType | null }>;
  mermaidArtifacts: TAttachment[];
  downloadableFileAttachments: TAttachment[];
  downloadableTextAttachments: TAttachment[];
  textOnlyAttachments: TAttachment[];
  groupedFileAttachments: TAttachment[];
  visibleTextAttachments: TAttachment[];
  resolvedPanel: Array<{ attachment: TAttachment; type: ToolArtifactType }>;
  pendingPanel: Array<{ attachment: TAttachment; type: null }>;
  groupDownloadableFiles: boolean;
}

export function classifyAttachmentsForGroup(attachments: TAttachment[]): AttachmentGroupBuckets {
  const fileAttachments: TAttachment[] = [];
  const imageAttachments: TAttachment[] = [];
  const textAttachments: TAttachment[] = [];
  const panelRow: Array<{ attachment: TAttachment; type: ToolArtifactType | null }> = [];
  const mermaidArtifacts: TAttachment[] = [];

  for (const attachment of attachments) {
    if (attachment.type === Tools.web_search) {
      continue;
    }
    if (isInternalSandboxArtifact(attachment)) {
      continue;
    }
    if (isImageAttachment(attachment)) {
      imageAttachments.push(attachment);
      continue;
    }
    if ((attachment as Partial<TFile>).status === 'pending') {
      panelRow.push({ attachment, type: null });
      continue;
    }
    const artType = artifactTypeForAttachment(attachment);
    if (artType === TOOL_ARTIFACT_TYPES.MERMAID) {
      mermaidArtifacts.push(attachment);
      continue;
    }
    if (artType != null) {
      panelRow.push({ attachment, type: artType });
      continue;
    }
    if (isTextAttachment(attachment)) {
      textAttachments.push(attachment);
      continue;
    }
    fileAttachments.push(attachment);
  }

  fileAttachments.sort(bySalience);
  textAttachments.sort(bySalience);

  const resolvedPanel = panelRow.filter(
    (e): e is { attachment: TAttachment; type: ToolArtifactType } => e.type != null,
  );
  const pendingPanel = panelRow.filter(
    (e): e is { attachment: TAttachment; type: null } => e.type == null,
  );
  resolvedPanel.sort(byEntrySalience);
  mermaidArtifacts.sort(bySalience);
  imageAttachments.sort(bySalience);

  const downloadableFileAttachments = fileAttachments.filter((attachment) =>
    Boolean(attachment.filepath),
  );
  const downloadableTextAttachments = textAttachments.filter((attachment) =>
    Boolean(attachment.filepath),
  );
  const textOnlyAttachments = textAttachments.filter((attachment) => !attachment.filepath);
  const groupDownloadableFiles =
    downloadableFileAttachments.length + downloadableTextAttachments.length > 1;
  const groupedFileAttachments = groupDownloadableFiles
    ? [...downloadableFileAttachments, ...downloadableTextAttachments].sort(bySalience)
    : downloadableFileAttachments;
  const visibleTextAttachments = groupDownloadableFiles ? textOnlyAttachments : textAttachments;

  return {
    fileAttachments,
    imageAttachments,
    textAttachments,
    panelRow,
    mermaidArtifacts,
    downloadableFileAttachments,
    downloadableTextAttachments,
    textOnlyAttachments,
    groupedFileAttachments,
    visibleTextAttachments,
    resolvedPanel,
    pendingPanel,
    groupDownloadableFiles,
  };
}

export const AttachmentGroupComponent = memo(function AttachmentGroupComponent({
  attachments,
}: {
  attachments?: TAttachment[];
}) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const buckets = classifyAttachmentsForGroup(attachments);
  const {
    groupedFileAttachments,
    resolvedPanel,
    pendingPanel,
    mermaidArtifacts,
    visibleTextAttachments,
    imageAttachments,
  } = buckets;

  return (
    <>
      {groupedFileAttachments.length > 0 && (
        <FileAttachmentGroup attachments={groupedFileAttachments} />
      )}
      {(resolvedPanel.length > 0 || pendingPanel.length > 0) && (
        <div className="my-2 flex flex-wrap items-center gap-2">
          {resolvedPanel.map(({ attachment, type }, index) => (
            <PanelArtifact
              attachment={attachment}
              type={type}
              key={renderAttachmentKey('artifact', attachment, index)}
            />
          ))}
          {pendingPanel.map(({ attachment }, index) =>
            attachment.filepath ? (
              <FileAttachment
                attachment={attachment}
                key={renderAttachmentKey('pending', attachment, index)}
              />
            ) : null,
          )}
        </div>
      )}
      {mermaidArtifacts.length > 0 && (
        <div className="my-2 flex flex-col gap-3">
          {mermaidArtifacts.map((attachment, index) => (
            <MermaidArtifact
              attachment={attachment}
              key={renderAttachmentKey('mermaid', attachment, index)}
            />
          ))}
        </div>
      )}
      {visibleTextAttachments.length > 0 && (
        <div className="my-2 flex flex-col gap-3">
          {visibleTextAttachments.map((attachment, index) => (
            <TextAttachmentComponent
              attachment={attachment}
              key={renderAttachmentKey('text', attachment, index)}
            />
          ))}
        </div>
      )}
      {imageAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center">
          {imageAttachments.map((attachment, index) => (
            <ImageAttachment
              attachment={attachment}
              key={renderAttachmentKey('image', attachment, index)}
            />
          ))}
        </div>
      )}
    </>
  );
});

export default attachmentRenderers;
