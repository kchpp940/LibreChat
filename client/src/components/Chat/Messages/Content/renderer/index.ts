/**
 * @internal V1 Renderer Compatibility Layer
 *
 * This module is an internal implementation detail. External consumers MUST
 * use the standard parser + registry pipeline exported from `../render.ts`:
 *
 *   import { RenderStandardItem, parseMessageContent } from '../render';
 *
 * The v1 APIs (RenderContentPart, RenderToolCallContent, RenderAttachment,
 * findContentPartRenderer, findToolCallRenderer, findAttachmentRenderer,
 * contentPartRegistry, toolCallRegistry, attachmentRegistry) are retained
 * for backward compatibility but should NOT be imported directly by
 * business components. New content types should register via
 * `standardRendererRegistry.register()` from `../render.ts`.
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

/** @internal */
export const contentPartRegistry = new RendererRegistry<
  ContentPartRendererProps,
  TMessageContentParts
>();
/** @internal */
export const toolCallRegistry = new RendererRegistry<ToolCallRendererProps, ToolCallMatchInput>();
/** @internal */
export const attachmentRegistry = new RendererRegistry<
  AttachmentRendererProps,
  TAttachment
>();

/** @internal */
export function initializeRenderers() {
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

/** @internal */
export {
  contentPartRenderers,
  toolCallRenderers,
  attachmentRenderers,
};
/** @internal */
export * from './types';
/** @internal */
export { RendererRegistry } from './RendererRegistry';
/**
 * @internal Use RenderStandardItem from ../render instead.
 */
export {
  RenderContentPart,
  RenderToolCallContent,
  RenderAttachment,
  findContentPartRenderer,
  findToolCallRenderer,
  findAttachmentRenderer,
} from './RendererAdapter';
/**
 * @internal Use RenderStandardItem for attachments instead.
 */
export {
  AttachmentGroupComponent,
  classifyAttachmentsForGroup,
} from './attachmentRenderers';
