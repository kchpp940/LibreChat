import type { ComponentType, ReactNode } from 'react';
import type {
  RenderableItem,
  RenderableKind,
  RenderableSource,
  RenderableMatchInput,
} from '../../parser/types';

export interface RendererMatchResult {
  matched: boolean;
  priority?: number;
}

export interface StandardRendererProps {
  item: RenderableItem;
  isSubmitting?: boolean;
  isCreatedByUser?: boolean;
  isLast?: boolean;
  showCursor?: boolean;
  [key: string]: unknown;
}

export interface StandardRenderer {
  id: string;
  name: string;
  kind?: RenderableKind;
  source?: RenderableSource;
  match: (input: RenderableMatchInput) => RendererMatchResult;
  render: ComponentType<StandardRendererProps>;
  priority?: number;
}

export { type RenderableItem, type RenderableKind, type RenderableSource, type RenderableMatchInput };
