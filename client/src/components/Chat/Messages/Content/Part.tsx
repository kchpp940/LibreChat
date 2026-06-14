import { memo } from 'react';
import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import { RenderContentPart } from './renderer/RendererAdapter';

type PartProps = {
  part?: TMessageContentParts;
  isLast?: boolean;
  isSubmitting: boolean;
  showCursor: boolean;
  isCreatedByUser: boolean;
  attachments?: TAttachment[];
  hideAttachments?: boolean;
  onToolExpand?: () => void;
};

const Part = memo(function Part({
  part,
  isSubmitting,
  attachments,
  isLast,
  showCursor,
  isCreatedByUser,
  hideAttachments,
  onToolExpand,
}: PartProps) {
  if (!part) {
    return null;
  }

  return (
    <RenderContentPart
      part={part}
      isLast={isLast}
      isSubmitting={isSubmitting}
      showCursor={showCursor}
      isCreatedByUser={isCreatedByUser}
      attachments={attachments}
      hideAttachments={hideAttachments}
      onToolExpand={onToolExpand}
    />
  );
});
Part.displayName = 'Part';

export default Part;
