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

export const contentPartRegistry = new RendererRegistry<
  ContentPartRendererProps,
  TMessageContentParts
>();
export const toolCallRegistry = new RendererRegistry<ToolCallRendererProps, ToolCallMatchInput>();
export const attachmentRegistry = new RendererRegistry<
  AttachmentRendererProps,
  TAttachment
>();

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

export {
  contentPartRenderers,
  toolCallRenderers,
  attachmentRenderers,
};
export * from './types';
export { RendererRegistry } from './RendererRegistry';
export {
  RenderContentPart,
  RenderToolCallContent,
  RenderAttachment,
  findContentPartRenderer,
  findToolCallRenderer,
  findAttachmentRenderer,
} from './RendererAdapter';
export {
  AttachmentGroupComponent,
  classifyAttachmentsForGroup,
} from './attachmentRenderers';
