import { memo } from 'react';
import type { TAttachment } from 'librechat-data-provider';
import type {
  ContentBlock,
  ParallelSectionSummary,
  MessageRenderState,
} from '~/common';
import { SearchContext, SearchContextValue } from '~/Providers';
import { BlockRenderer } from './BlockRenderer';
import Container from '~/components/Chat/Messages/Content/Container';
import { EmptyText, PendingSkillCall } from '~/components/Chat/Messages/Content/Parts';
import MemoryArtifacts from '~/components/Chat/Messages/Content/MemoryArtifacts';
import Sources from '~/components/Web/Sources';
import SiblingHeader from '~/components/Chat/Messages/Content/SiblingHeader';
import { cn } from '~/utils';

type ParallelColumnProps = {
  agentId: string;
  blocks: ContentBlock[];
  isEmpty: boolean;
  groupId: number;
  messageId: string;
  conversationId?: string | null;
  isSubmitting: boolean;
  isCreatedByUser: boolean;
  isLatestMessage?: boolean;
  isLastColumn: boolean;
};

const ParallelColumn = memo(function ParallelColumn({
  agentId,
  blocks,
  isEmpty,
  groupId,
  messageId,
  conversationId,
  isSubmitting,
  isCreatedByUser,
  isLatestMessage,
  isLastColumn,
}: ParallelColumnProps) {
  const showLoadingCursor = isSubmitting && isEmpty;

  return (
    <div
      key={`column-${messageId}-${groupId}-${agentId}`}
      className="min-w-0 flex-1 rounded-lg border border-border-light p-3"
    >
      <SiblingHeader
        agentId={agentId}
        messageId={messageId}
        isSubmitting={isSubmitting}
        conversationId={conversationId}
      />
      {showLoadingCursor ? (
        <Container>
          <EmptyText />
        </Container>
      ) : (
        blocks.map((block, idx) => (
          <BlockRenderer
            key={block.id}
            block={block}
            messageId={messageId}
            conversationId={conversationId}
            isSubmitting={isSubmitting}
            isLatestMessage={isLatestMessage}
            isCreatedByUser={isCreatedByUser}
            isLast={isLastColumn && idx === blocks.length - 1}
          />
        ))
      )}
    </div>
  );
});

type ParallelSectionProps = {
  section: ParallelSectionSummary;
  messageId: string;
  conversationId?: string | null;
  isSubmitting: boolean;
  isCreatedByUser: boolean;
  isLatestMessage?: boolean;
};

const ParallelSection = memo(function ParallelSection({
  section,
  messageId,
  conversationId,
  isSubmitting,
  isCreatedByUser,
  isLatestMessage,
}: ParallelSectionProps) {
  return (
    <div className={cn('flex w-full flex-col gap-3 md:flex-row', 'sibling-content-group')}>
      {section.columns.map((col, colIdx) => (
        <ParallelColumn
          key={`column-${messageId}-${section.groupId}-${col.agentId || colIdx}`}
          agentId={col.agentId}
          blocks={col.blocks}
          isEmpty={col.isEmpty}
          groupId={section.groupId}
          messageId={messageId}
          conversationId={conversationId}
          isSubmitting={isSubmitting}
          isCreatedByUser={isCreatedByUser}
          isLatestMessage={isLatestMessage}
          isLastColumn={colIdx === section.columns.length - 1}
        />
      ))}
    </div>
  );
});

export type ParallelRendererProps = {
  state: MessageRenderState;
  searchCtxValue: SearchContextValue;
  attachmentsForGroup: TAttachment[];
};

export const ParallelRenderer = memo(function ParallelRenderer({
  state,
  searchCtxValue,
  attachmentsForGroup,
}: ParallelRendererProps) {
  const { parallelSections, pendingSkills, hasPendingSkills } = state;

  const sequentialBlocks = state.blocks.filter(
    (b) => !parallelSections.some((s) =>
      s.columns.some((c) => c.blocks.some((cb) => cb.id === b.id)),
    ),
  );

  const allParallelIndices = new Set(
    parallelSections.flatMap((s) =>
      s.columns.flatMap((c) => c.blocks.map((b) => b.partIndex)),
    ),
  );
  const beforeBlocks = sequentialBlocks.filter(
    (b) => !allParallelIndices.has(b.partIndex) || b.partIndex < Math.min(...Array.from(allParallelIndices.values()), Infinity),
  );
  const afterBlocks = sequentialBlocks.filter(
    (b) => b.partIndex > Math.max(...Array.from(allParallelIndices.values()), -1) && !beforeBlocks.includes(b),
  );

  return (
    <SearchContext.Provider value={searchCtxValue}>
      <MemoryArtifacts attachments={attachmentsForGroup} />
      <Sources messageId={state.messageId} conversationId={state.conversationId || undefined} />

      {hasPendingSkills &&
        pendingSkills.map((name) => (
          <PendingSkillCall
            key={`pending-skill-${name}`}
            skillName={name}
            loaded={state.hasRealContent}
          />
        ))}

      {beforeBlocks.map((block, idx) => (
        <BlockRenderer
          key={block.id}
          block={block}
          messageId={state.messageId}
          conversationId={state.conversationId}
          isSubmitting={state.isSubmitting}
          isLatestMessage={state.isLatestMessage}
          isCreatedByUser={state.isCreatedByUser}
          isLast={false}
        />
      ))}

      {parallelSections.map((section) => (
        <ParallelSection
          key={`parallel-section-${state.messageId}-${section.groupId}`}
          section={section}
          messageId={state.messageId}
          conversationId={state.conversationId}
          isSubmitting={state.isSubmitting}
          isCreatedByUser={state.isCreatedByUser}
          isLatestMessage={state.isLatestMessage}
        />
      ))}

      {afterBlocks.map((block, idx) => (
        <BlockRenderer
          key={block.id}
          block={block}
          messageId={state.messageId}
          conversationId={state.conversationId}
          isSubmitting={state.isSubmitting}
          isLatestMessage={state.isLatestMessage}
          isCreatedByUser={state.isCreatedByUser}
          isLast={idx === afterBlocks.length - 1}
        />
      ))}
    </SearchContext.Provider>
  );
});
