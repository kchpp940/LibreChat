/**
 * Standard Message Content Rendering API
 *
 * This is the ONLY public entry point for message content rendering.
 * All business components should import from this module.
 *
 * Architecture:
 *   Raw message structure → Parser (RenderableItem) → Registry → Renderer
 *
 * To add a new content type:
 *   1. Add a new RenderableXxx type in parser/types.ts
 *   2. Add a resolveXxxKind rule in parser/MessageContentParser.ts
 *   3. Register a new renderer in renderer/v2/standardRenderers.tsx
 *   4. Done — no need to modify any UI component or this file
 */

/* ── Parser: raw structure → standard RenderableItem ── */
export {
  parseMessageContent,
  partToRenderable,
  attachmentToRenderable,
  legacyTextToRenderable,
  pendingSkillToRenderable,
  hasRealContent,
  isEditablePart,
  getToolCallId,
  type PartToRenderableContext,
  type ParsedMessageContent,
} from './parser';

/* ── Standard types ── */
export type {
  RenderableItem,
  RenderableText,
  RenderableThink,
  RenderableImage,
  RenderableError,
  RenderableSummary,
  RenderableAgentUpdate,
  RenderableToolCall,
  RenderableAttachment,
  RenderableArtifact,
  RenderablePendingSkill,
  RenderableEmptyCursor,
  RenderableKind,
  RenderableSource,
  RenderableMatchInput,
  RenderableItemGroup,
  ParseMessageContentOptions,
} from './parser/types';

/* ── Rendering: RenderableItem → React component ── */
export { RenderStandardItem, AttachmentGroup } from './renderer/RenderStandard';

/* ── Registry: for extending with new content types ── */
export { standardRendererRegistry, initializeStandardRenderers } from './renderer/v2';
export type { StandardRenderer, StandardRendererProps } from './renderer/v2/types';

/* ── Hooks ── */
export {
  useParsedMessageContent,
  useRenderableParts,
  useRenderableAttachments,
  useHasRealContent,
} from '~/hooks/Messages/useParsedMessageContent';
