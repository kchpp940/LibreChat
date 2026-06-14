/**
 * @internal V1 Renderer Compatibility Layer — PRIVATE MODULE
 *
 * ⚠️  This entire directory is an internal implementation detail.
 *     External consumers MUST use the standard pipeline from `../render.ts`:
 *
 *       import { RenderStandardItem, parseMessageContent } from '../render';
 *
 *     Direct imports from this module or its sub-paths are prohibited
 *     and enforced by ESLint `import/no-restricted-paths`.
 *
 * The v1 APIs below are retained SOLELY as internal glue between
 * render.ts / Part.tsx / Attachment.tsx and the underlying renderer
 * implementations.  They are NOT re-exported and must NOT be imported
 * by any file outside this directory.
 */

import { RendererRegistry } from './RendererRegistry';
import type {
  ContentPartRendererProps,
  ToolCallRendererProps,
  AttachmentRendererProps,
  ToolCallMatchInput,
} from './types';
import { contentPartRenderers } from './contentPartRenderers';
import { toolCallRenderers } from './toolCallRenderers';
import { attachmentRenderers } from './attachmentRenderers';
import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import type { BaseRenderer } from './RendererRegistry';

const contentPartRegistry = new RendererRegistry<
  ContentPartRendererProps,
  TMessageContentParts
>();
const toolCallRegistry = new RendererRegistry<ToolCallRendererProps, ToolCallMatchInput>();
const attachmentRegistry = new RendererRegistry<
  AttachmentRendererProps,
  TAttachment
>();

function initializeRenderers() {
  contentPartRenderers.forEach((r) => contentPartRegistry.register(r));
  toolCallRenderers.forEach((r) => toolCallRegistry.register(r));
  attachmentRenderers.forEach(
    (r) =>
      attachmentRegistry.register(
        r as BaseRenderer<AttachmentRendererProps, TAttachment>,
      ),
  );
}

initializeRenderers();

export {
  contentPartRenderers,
  toolCallRenderers,
  attachmentRenderers,
};
export * from './types';
export { RendererRegistry } from './RendererRegistry';
export { RenderStandardItem, AttachmentGroup } from './RenderStandard';
export { AttachmentGroupComponent, classifyAttachmentsForGroup } from './attachmentRenderers';
