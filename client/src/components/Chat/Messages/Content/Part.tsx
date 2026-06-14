import { memo, useMemo, ReactNode } from 'react';
import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import { partToRenderable, type PartToRenderableContext } from './parser';
import { RenderStandardItem } from './renderer/RenderStandard';
import { mapAttachments } from '~/utils';

type PartProps = {
  part?: TMessageContentParts;
  isLast?: boolean;
  isSubmitting: boolean;
  showCursor: boolean;
  isCreatedByUser: boolean;
  attachments?: TAttachment[];
  hideAttachments?: boolean;
  onToolExpand?: () => void;
  messageId?: string;
  partIndex?: number;
  isLastPart?: boolean;
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
  messageId = 'part',
  partIndex = 0,
  isLastPart,
}: PartProps): ReactNode {
  if (!part) {
    return null;
  }

  const attachmentMap = useMemo(() => mapAttachments(attachments ?? []), [attachments]);

  const renderable = useMemo(
    () =>
      partToRenderable(part, partIndex, {
        messageId,
        attachments,
        attachmentMap,
        isSubmitting,
        isLast,
        isLastPart: isLastPart ?? isLast,
      }),
    [part, partIndex, messageId, attachments, attachmentMap, isSubmitting, isLast, isLastPart],
  );

  if (!renderable) {
    return null;
  }

  return (
    <RenderStandardItem
      item={renderable}
      isSubmitting={isSubmitting}
      isCreatedByUser={isCreatedByUser}
      isLast={isLast}
      showCursor={showCursor}
      onToolExpand={onToolExpand}
    />
  );
});
Part.displayName = 'Part';

export default Part;
