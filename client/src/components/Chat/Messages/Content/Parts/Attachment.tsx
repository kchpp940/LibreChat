import type { TAttachment } from 'librechat-data-provider';
import { RenderAttachment, AttachmentGroupComponent } from '../renderer';

export default function Attachment({ attachment }: { attachment?: TAttachment }) {
  return <RenderAttachment attachment={attachment} />;
}

export function AttachmentGroup({ attachments }: { attachments?: TAttachment[] }) {
  return <AttachmentGroupComponent attachments={attachments} />;
}
