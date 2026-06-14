import type { TAttachment } from 'librechat-data-provider';
import { attachmentToRenderable } from '../parser';
import { RenderStandardItem } from '../renderer/RenderStandard';
import { AttachmentGroupComponent } from '../renderer/attachmentRenderers';

export default function Attachment({ attachment }: { attachment?: TAttachment }) {
  if (!attachment) return null;
  const item = attachmentToRenderable(attachment, 0);
  if (!item) return null;
  return <RenderStandardItem item={item} />;
}

export function AttachmentGroup({ attachments }: { attachments?: TAttachment[] }) {
  return <AttachmentGroupComponent attachments={attachments} />;
}
