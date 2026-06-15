import { memo, Suspense, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import { DelayedRender } from '@librechat/client';
import { ContentTypes } from 'librechat-data-provider';
import type { TAttachment } from 'librechat-data-provider';
import {
  MessageRenderStatus,
  type MessageRenderState,
  type TextBlock,
  type ToolCallGroupSummary,
} from '~/common';
import { EmptyText, EditTextPart, PendingSkillCall } from '~/components/Chat/Messages/Content/Parts';
import Container from '~/components/Chat/Messages/Content/Container';
import { ErrorMessage, UnfinishedMessage } from '~/components/Chat/Messages/Content/MessageContent';
import EditMessage from '~/components/Chat/Messages/Content/EditMessage';
import MemoryArtifacts from '~/components/Chat/Messages/Content/MemoryArtifacts';
import { AttachmentGroup } from '~/components/Chat/Messages/Content/Parts/Attachment';
import { SearchContext, MessageContext, SearchContextValue } from '~/Providers';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { fontSizeAtom } from '~/store/fontSize';
import { cn, getHeaderPrefixForScreenReader, getMessageAriaLabel } from '~/utils';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import SiblingSwitch from '~/components/Chat/Messages/SiblingSwitch';
import HoverButtons from '~/components/Chat/Messages/HoverButtons';
import SubRow from '~/components/Chat/Messages/SubRow';
import PlaceholderRow from '~/components/Chat/Messages/ui/PlaceholderRow';
import MultiMessage from '~/components/Chat/Messages/MultiMessage';
import { BlockRenderer } from './BlockRenderer';
import { ToolCallGroupRenderer, type ToolCallGroupExpansionState } from './ToolCallGroupRenderer';
import { ParallelRenderer } from './ParallelRenderer';

const UNFINISHED_DELAY = 250;

type MessageContentFromStateProps = {
  state: MessageRenderState;
  toolGroupExpansionRef: React.MutableRefObject<Map<string, ToolCallGroupExpansionState>>;
  handleGroupExpansionChange: (groupId: string, state: ToolCallGroupExpansionState) => void;
};

const MessageContentFromState = memo(function MessageContentFromState({
  state,
  toolGroupExpansionRef,
  handleGroupExpansionChange,
}: MessageContentFromStateProps) {
  const searchCtxValue: SearchContextValue = useMemo(
    () => ({ searchResults: state.searchResults as any }),
    [state.searchResults],
  );

  const attachmentsForGroup: TAttachment[] = state.attachments.map((a) => a.attachment);

  if (state.status === MessageRenderStatus.ERROR && state.error) {
    return (
      <ErrorMessage
        text={state.error.message}
        message={{ messageId: state.messageId } as any}
      />
    );
  }

  if (state.status === MessageRenderStatus.UNFINISHED) {
    return (
      <Suspense>
        <DelayedRender delay={UNFINISHED_DELAY}>
          <UnfinishedMessage message={{ messageId: state.messageId, text: '' } as any} />
        </DelayedRender>
      </Suspense>
    );
  }

  if (state.hasParallelContent) {
    return (
      <ParallelRenderer
        state={state}
        searchCtxValue={searchCtxValue}
        attachmentsForGroup={attachmentsForGroup}
      />
    );
  }

  return (
    <SearchContext.Provider value={searchCtxValue}>
      <MemoryArtifacts attachments={attachmentsForGroup} />
      {state.hasPendingSkills &&
        state.pendingSkills.map((name) => (
          <PendingSkillCall
            key={`pending-skill-${name}`}
            skillName={name}
            loaded={state.hasRealContent}
          />
        ))}
      {state.showEmptyCursor && (
        <Container>
          <EmptyText />
        </Container>
      )}
      {state.toolCallGroups.length > 0
        ? renderGroupedContent(state, toolGroupExpansionRef, handleGroupExpansionChange)
        : state.blocks.map((block, idx) => (
            <BlockRenderer
              key={block.id}
              block={block}
              messageId={state.messageId}
              conversationId={state.conversationId}
              isSubmitting={state.isSubmitting}
              isLatestMessage={state.isLatestMessage}
              isCreatedByUser={state.isCreatedByUser}
              isLast={idx === state.blocks.length - 1}
            />
          ))}
    </SearchContext.Provider>
  );
});

function renderGroupedContent(
  state: MessageRenderState,
  toolGroupExpansionRef: React.MutableRefObject<Map<string, ToolCallGroupExpansionState>>,
  handleGroupExpansionChange: (groupId: string, s: ToolCallGroupExpansionState) => void,
): React.ReactNode {
  const groupedPartIndices = new Set(
    state.toolCallGroups.flatMap((g) => g.toolBlocks.map((b) => b.partIndex)),
  );

  const nonGroupedBlocks = state.blocks.filter(
    (b) => !groupedPartIndices.has(b.partIndex),
  );

  const sortedEntries: Array<
    | { kind: 'block'; block: typeof nonGroupedBlocks[number]; order: number }
    | { kind: 'group'; group: ToolCallGroupSummary; order: number }
  > = [];

  for (const block of nonGroupedBlocks) {
    sortedEntries.push({ kind: 'block', block, order: block.partIndex });
  }
  for (const group of state.toolCallGroups) {
    const minIdx = Math.min(...group.toolBlocks.map((b) => b.partIndex));
    sortedEntries.push({ kind: 'group', group, order: minIdx });
  }
  sortedEntries.sort((a, b) => a.order - b.order);

  return (
    <>
      {sortedEntries.map((entry) => {
        if (entry.kind === 'block') {
          return (
            <BlockRenderer
              key={entry.block.id}
              block={entry.block}
              messageId={state.messageId}
              conversationId={state.conversationId}
              isSubmitting={state.isSubmitting}
              isLatestMessage={state.isLatestMessage}
              isCreatedByUser={state.isCreatedByUser}
              isLast={false}
            />
          );
        }
        const group = entry.group;
        return (
          <ToolCallGroupRenderer
            key={`tool-group-${group.groupId}`}
            groupId={group.groupId}
            toolBlocks={group.toolBlocks}
            groupAttachments={group.groupAttachments}
            isSubmitting={group.isSubmitting}
            isLast={group.isLast}
            messageId={state.messageId}
            conversationId={state.conversationId}
            isCreatedByUser={state.isCreatedByUser}
            isLatestMessage={state.isLatestMessage}
            initialExpansionState={toolGroupExpansionRef.current.get(group.groupId)}
            onExpansionChange={(s) => handleGroupExpansionChange(group.groupId, s)}
          />
        );
      })}
    </>
  );
}

type EditContentFromStateProps = {
  state: MessageRenderState;
};

const EditContentFromState = memo(function EditContentFromState({
  state,
}: EditContentFromStateProps) {
  const editBlocks = state.blocks.filter(
    (b) => b.type === 'text' || b.type === 'thinking',
  );

  return (
    <>
      {editBlocks.map((block, idx) => (
        <EditTextPart
          index={block.partIndex}
          part={{ type: block.type === 'thinking' ? ContentTypes.THINK : ContentTypes.TEXT, text: (block as TextBlock).text, think: block.type === 'thinking' ? (block as any).reasoning : undefined } as any}
          messageId={state.messageId}
          isSubmitting={state.isSubmitting}
          enterEdit={state.actions.enterEdit}
          siblingIdx={state.siblingIdx ?? null}
          setSiblingIdx={(v: number) => {
            if (state.setSiblingIdx) state.setSiblingIdx(v);
          }}
          key={`edit-${state.messageId}-${idx}`}
        />
      ))}
    </>
  );
});

type RenderedMessageProps = {
  state: MessageRenderState;
  conversation?: any;
  messageChildren?: any[];
  toolGroupExpansionRef: React.MutableRefObject<Map<string, ToolCallGroupExpansionState>>;
  handleGroupExpansionChange: (groupId: string, s: ToolCallGroupExpansionState) => void;
};

const RenderedMessage = memo(function RenderedMessage({
  state,
  conversation,
  messageChildren,
  toolGroupExpansionRef,
  handleGroupExpansionChange,
}: RenderedMessageProps) {
  const localize = useLocalize();
  const fontSize = useAtomValue(fontSizeAtom);
  const hasParallelContent = state.hasParallelContent;

  const messageContextForInner = useMemo(
    () => ({
      messageId: state.messageId,
      isLatestMessage: state.isLatestMessage,
      isExpanded: false as const,
      isSubmitting: state.isSubmitting,
      conversationId: state.conversationId,
    }),
    [state.messageId, state.conversationId, state.isSubmitting, state.isLatestMessage],
  );

  const baseClasses = {
    common:
      'group mx-auto flex flex-1 gap-3 transition-all duration-300 transform-gpu',
    chat: state.chatWidthClass,
  };

  return (
    <>
      <div
        id={state.messageId}
        aria-label={getMessageAriaLabel(
          { messageId: state.messageId, isCreatedByUser: state.isCreatedByUser } as any,
          localize,
        )}
        className={cn(
          baseClasses.common,
          baseClasses.chat,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy',
          'message-render',
        )}
      >
        {!hasParallelContent && (
          <div className="relative flex flex-shrink-0 flex-col items-center">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
              <MessageIcon
                iconData={state.iconData}
                assistant={state.assistant as any}
                agent={state.agent as any}
              />
            </div>
          </div>
        )}
        <div
          className={cn(
            'relative flex flex-col',
            hasParallelContent ? 'w-full' : 'w-11/12',
            state.isCreatedByUser ? 'user-turn' : 'agent-turn',
          )}
        >
          {!hasParallelContent && (
            <h2 className={cn('select-none font-semibold', fontSize)}>
              <span className="sr-only">
                {getHeaderPrefixForScreenReader(
                  { messageId: state.messageId, isCreatedByUser: state.isCreatedByUser } as any,
                  localize,
                )}
              </span>
              {state.label}
            </h2>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex min-h-[20px] max-w-full flex-grow flex-col gap-0">
              <MessageContext.Provider value={messageContextForInner}>
                {state.status === MessageRenderStatus.EDITING ? (
                  state.setCurrentEditId && state.setSiblingIdx ? (
                    <EditMessage
                      text={state.blocks
                        .filter((b) => b.type === 'text')
                        .map((b) => (b as TextBlock).text)
                        .join('\n')}
                      isSubmitting={state.isSubmitting}
                      message={{ messageId: state.messageId } as any}
                      enterEdit={state.actions.enterEdit}
                      siblingIdx={state.siblingIdx ?? 0}
                      setSiblingIdx={state.setSiblingIdx ?? (() => ({}))}
                      ask={state.actions.ask}
                    />
                  ) : (
                    <EditContentFromState state={state} />
                  )
                ) : (
                  <MessageContentFromState
                    state={state}
                    toolGroupExpansionRef={toolGroupExpansionRef}
                    handleGroupExpansionChange={handleGroupExpansionChange}
                  />
                )}
                {state.attachments.length > 0 && (
                  <AttachmentGroup
                    attachments={state.attachments.map((a) => a.attachment)}
                  />
                )}
              </MessageContext.Provider>
            </div>
            {state.isLastInTree && state.isSubmitting ? (
              <PlaceholderRow />
            ) : (
              <SubRow classes="text-xs">
                <SiblingSwitch
                  siblingIdx={state.siblingIdx}
                  siblingCount={state.siblingCount}
                  setSiblingIdx={state.setSiblingIdx}
                />
                <HoverButtons
                  index={state.actions.index}
                  isEditing={state.actions.edit}
                  message={{ messageId: state.messageId } as any}
                  enterEdit={state.actions.enterEdit}
                  isSubmitting={state.chatContext.isSubmitting}
                  conversation={conversation ?? null}
                  regenerate={state.actions.regenerate}
                  copyToClipboard={state.actions.copyToClipboard as any}
                  handleContinue={state.actions.handleContinue}
                  latestMessageId={state.chatContext.latestMessageId}
                  handleFeedback={state.actions.handleFeedback as any}
                  isLast={state.isLastInTree}
                />
              </SubRow>
            )}
          </div>
        </div>
      </div>
      <MultiMessage
        messageId={state.messageId ?? null}
        conversation={conversation}
        messagesTree={messageChildren ?? []}
        currentEditId={state.currentEditId ?? null}
        setCurrentEditId={state.setCurrentEditId as any}
      />
    </>
  );
});

RenderedMessage.displayName = 'RenderedMessage';
MessageContentFromState.displayName = 'MessageContentFromState';
EditContentFromState.displayName = 'EditContentFromState';

export { RenderedMessage, MessageContentFromState, EditContentFromState };
