import type { RendererMatchResult } from '../RendererRegistry';
import { RendererRegistry } from '../RendererRegistry';
import type {
  StandardRenderer,
  StandardRendererProps,
} from './types';
import type { RenderableItem, RenderableMatchInput } from '../../parser/types';
import { standardRenderers } from './standardRenderers';

export const standardRendererRegistry = new RendererRegistry<
  StandardRendererProps,
  RenderableMatchInput
>();

export function toRenderableMatchInput(item: RenderableItem): RenderableMatchInput {
  const result: RenderableMatchInput = {
    kind: item.kind,
    source: item.source,
    metadata: item.metadata,
  };
  if (item.kind === 'tool_call') {
    (result as RenderableMatchInput & { toolKind?: string }).toolKind = (item as { toolKind?: string }).toolKind;
  }
  if (item.kind === 'attachment') {
    (result as RenderableMatchInput & { attachmentType?: string }).attachmentType = (
      item as { attachmentType?: string }
    ).attachmentType;
  }
  if (item.kind === 'artifact') {
    (result as RenderableMatchInput & { artifactType?: string }).artifactType = String(
      (item as { artifactType?: string }).artifactType ?? '',
    );
  }
  return result;
}

export function initializeStandardRenderers() {
  standardRenderers.forEach((r) => standardRendererRegistry.register(r));
}

initializeStandardRenderers();

export { standardRenderers };
export * from './types';
export type { StandardRenderer, StandardRendererProps };
