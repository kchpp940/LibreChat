import { memo, ReactNode } from 'react';
import type {
  RenderableItem,
  RenderableAttachment,
  RenderableArtifact,
} from '../parser/types';
import {
  standardRendererRegistry,
  toRenderableMatchInput,
} from './v2';
import type { StandardRendererProps } from './v2/types';
import { AttachmentGroupComponent, classifyAttachmentsForGroup } from './attachmentRenderers';
import type { TAttachment } from 'librechat-data-provider';

export interface RenderStandardItemProps extends StandardRendererProps {
  item: RenderableItem;
  onToolExpand?: () => void;
}

export const RenderStandardItem = memo(function RenderStandardItem(
  props: RenderStandardItemProps,
): ReactNode {
  const { item, onToolExpand } = props;
  if (!item) return null;

  const matchInput = toRenderableMatchInput(item);
  const renderer = standardRendererRegistry.match(matchInput);
  if (!renderer) return null;

  const RenderComponent = renderer.render;
  const finalProps: StandardRendererProps & { onToolExpand?: () => void } = {
    ...props,
    onToolExpand,
  };
  return <RenderComponent {...finalProps} />;
});

export const RenderAttachmentItem = memo(function RenderAttachmentItem({
  item,
}: {
  item: RenderableAttachment | RenderableArtifact;
}): ReactNode {
  return <RenderStandardItem item={item} />;
});

export const AttachmentGroup = memo(function AttachmentGroup({
  attachments,
}: {
  attachments?: TAttachment[];
}): ReactNode {
  return <AttachmentGroupComponent attachments={attachments} />;
});

export { classifyAttachmentsForGroup };
