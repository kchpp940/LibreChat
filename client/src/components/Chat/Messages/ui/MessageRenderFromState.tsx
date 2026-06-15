import { memo, Suspense, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import { DelayedRender } from '@librechat/client';
import type { TMessageContentParts } from 'librechat-data-provider';
import { ContentTypes } from 'librechat-data-provider';
import type { TAttachment } from 'librechat-data-provider';
import {
  MessageRenderStatus,
  type MessageRenderState,
  type ContentBlock,
  type TextBlock,
  type ThinkingBlock,
  type ToolCallBlock,
  type ImageBlock,
  type ErrorBlock,
  type AgentUpdateBlock,
  type SummaryBlock,
} from '~/common';
import {
  ExecuteCode,
  AgentUpdate,
  EmptyText,
  Reasoning,
  Summary,
  Text,
  SkillCall,
  ReadFileCall,
  FileAuthoringCall,
  BashCall,
  SubagentCall,
  EditTextPart,
  PendingSkillCall,
} from '~/components/Chat/Messages/Content/Parts';
import { ImageGen } from '~/components/Chat/Messages/Content/Parts/OpenAIImageGen';
import Container from '~/components/Chat/Messages/Content/Container';
import RetrievalCall from '~/components/Chat/Messages/Content/RetrievalCall';
import AgentHandoff from '~/components/Chat/Messages/Content/AgentHandoff';
import CodeAnalyze from '~/components/Chat/Messages/Content/CodeAnalyze';
import WebSearch from '~/components/Chat/Messages/Content/WebSearch';
import ToolCall from '~/components/Chat/Messages/Content/ToolCall';
import Image from '~/components/Chat/Messages/Content/Image';
import { AttachmentGroup } from '~/components/Chat/Messages/Content/Parts/Attachment';
import { ErrorMessage, UnfinishedMessage } from '~/components/Chat/Messages/Content/MessageContent';
import EditMessage from '~/components/Chat/Messages/Content/EditMessage';
import MemoryArtifacts from '~/components/Chat/Messages/Content/MemoryArtifacts';
import ToolCallGroup, {
  type ToolCallGroupExpansionState,
} from '~/components/Chat/Messages/Content/ToolCallGroup';
import { ParallelContentRenderer } from '~/components/Chat/Messages/Content/ParallelContent';
import {
  SearchContext,
  MessageContext,
  SearchContextValue,
} from '~/Providers';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { fontSizeAtom } from '~/store/fontSize';
import { cn, getHeaderPrefixForScreenReader, getMessageAriaLabel
} from '~/utils';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import SiblingSwitch from '~/components/Chat/Messages/SiblingSwitch';
import HoverButtons from '~/components/Chat/Messages/HoverButtons';
import SubRow from '~/components/Chat/Messages/SubRow';
import PlaceholderRow from '~/components/Chat/Messages/ui/PlaceholderRow';
import MultiMessage from '~/components/Chat/Messages/MultiMessage';

const UNFINISHED_DELAY = 250;

type BlockRendererComponentProps = {
  block: ContentBlock;
  messageId: string;
  conversationId?: string | null;
  isSubmitting: boolean;
  isLatestMessage?: boolean;
  isCreatedByUser: boolean;
  isLast: boolean;
};

function BlockRendererInner({
  block,
  messageId,
  conversationId,
  isSubmitting,
  isLatestMessage,
  isCreatedByUser,
  isLast,
}: BlockRendererComponentProps): React.ReactNode {
  const contextValue = useMemo(
    () => ({
      messageId,
      isExpanded: true as const,
      conversationId,
      partIndex: block.partIndex,
      nextType: block.nextType,
      isSubmitting,
      isLatestMessage,
    }),
    [messageId, conversationId, block.partIndex, block.nextType, isSubmitting, isLatestMessage],
  );

  let inner: React.ReactNode;

  switch (block.type) {
    case 'text': {
      const b = block as TextBlock;
      if (b.status === 'loading' && !b.text) {
        inner = (
          <Container>
            <EmptyText />
          </Container>
        );
      } else {
        inner = (
          <Container>
            <Text
              text={b.text}
              isCreatedByUser={isCreatedByUser}
              showCursor={block.showCursor}
            />
          </Container>
        );
      }
      break;
    }
    case 'thinking': {
      const b = block as ThinkingBlock;
      inner = <Reasoning reasoning={b.reasoning} isLast={block.isLast ?? false} />;
      break;
    }
    case 'error': {
      const b = block as ErrorBlock;
      inner = <ErrorMessage text={b.message} className="my-2" />;
      break;
    }
    case 'agent_update': {
        const b = block as AgentUpdateBlock;
        inner = (
          <>
            <AgentUpdate currentAgentId={b.agentId ?? ''} />
            {block.isLast && block.showCursor && (
              <Container>
                <EmptyText />
              </Container>
            )}
          </>
        );
        break;
      }
      case 'summary': {
        const b = block as SummaryBlock;
        const summaryContent: { type: ContentTypes.TEXT; text: string }[] | undefined =
          b.content != null
            ? [{ type: ContentTypes.TEXT, text: b.content }]
            : undefined;
        inner = (
          <Summary
            content={summaryContent}
            model={b.model}
            provider={b.provider}
            tokenCount={b.tokenCount}
            summarizing={b.summarizing}
          />
        );
        break;
      }
    case 'image': {
      const b = block as ImageBlock;
      inner = (
        <Image
          imagePath={b.cachedPreview ?? b.filepath ?? ''}
          altText={b.filename ?? 'Uploaded Image'}
          width={b.width}
          height={b.height}
        />
      );
      break;
    }
    case 'tool_call': {
      const b = block as ToolCallBlock;
      const args = typeof b.args === 'string' ? b.args : JSON.stringify(b.args ?? {});
      if (b.isProgrammaticBash || b.isBashTool) {
        inner = (
          <BashCall
            args={b.args as Record<string, unknown>}
            output={b.output ?? ''}
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            attachments={b.attachments}
            commandField="code"
            hideAttachments={b.hideAttachments}
          />
        );
      } else if (b.isExecuteCode) {
        inner = (
          <ExecuteCode
            attachments={b.attachments}
            isSubmitting={isSubmitting}
            output={b.output ?? ''}
            initialProgress={b.progress}
            args={b.args as Record<string, unknown>}
            hideAttachments={b.hideAttachments}
          />
        );
      } else if (b.isImageGen) {
        inner = (
          <ImageGen
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            toolName={b.toolName}
            args={args}
            output={b.output ?? ''}
            attachments={b.attachments}
            hideAttachments={b.hideAttachments}
          />
        );
      } else if (b.isSkill) {
        inner = (
          <SkillCall
            args={b.args as Record<string, unknown>}
            output={b.output ?? ''}
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            attachments={b.attachments}
            hideAttachments={b.hideAttachments}
          />
        );
      } else if (b.isSubagent) {
        inner = (
          <SubagentCall
            toolCallId={b.toolCallId}
            args={b.args as Record<string, unknown>}
            output={b.output ?? ''}
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            attachments={b.attachments}
            persistedContent={b.persistedContent}
            hideAttachments={b.hideAttachments}
          />
        );
      } else if (b.isReadFile) {
        inner = (
          <ReadFileCall
            args={b.args as Record<string, unknown>}
            output={b.output ?? ''}
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            attachments={b.attachments}
            hideAttachments={b.hideAttachments}
          />
        );
      } else if (b.isFileAuthoring) {
        inner = (
          <FileAuthoringCall
            toolName={b.toolName as 'create_file' | 'edit_file'}
            args={b.args as Record<string, unknown>}
            output={b.output ?? ''}
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            attachments={b.attachments}
            hideAttachments={b.hideAttachments}
          />
        );
      } else if (b.isWebSearch) {
        inner = (
          <WebSearch
            output={b.output ?? ''}
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            attachments={b.attachments}
            isLast={isLast}
          />
        );
      } else if (b.isRetrieval) {
        inner = (
          <RetrievalCall
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            output={b.output}
            attachments={b.attachments}
          />
        );
      } else if (b.isAgentHandoff) {
        inner = <AgentHandoff args={args} name={b.toolName || ''} />;
      } else if (b.isCodeInterpreter) {
        let input = '';
        let outputs: Record<string, unknown>[] = [];
        try {
          const parsed = typeof b.args === 'string' ? b.args : '';
          input = parsed;
          const parsedOutputs = JSON.parse(b.output ?? '[]');
          outputs = Array.isArray(parsedOutputs)
            ? (parsedOutputs as Record<string, unknown>[])
            : [];
        } catch (_) { /* noop */ }
        inner = (
          <CodeAnalyze
            initialProgress={b.progress}
            code={input}
            outputs={outputs}
          />
        );
      } else {
        inner = (
          <ToolCall
            args={args}
            name={b.toolName || ''}
            output={b.output ?? ''}
            initialProgress={b.progress}
            isSubmitting={isSubmitting}
            attachments={b.attachments}
            auth={typeof b.auth === 'string' ? b.auth : undefined}
            isLast={isLast}
            hideAttachments={b.hideAttachments}
          />
        );
      }
      break;
    }
    default:
      inner = null;
  }

  return (
    <MessageContext.Provider value={contextValue} key={block.id}>
      {inner}
    </MessageContext.Provider>
  );
}

const BlockRenderer = memo(BlockRendererInner);

type ContentFromStateProps = {
  state: MessageRenderState;
  toolGroupExpansionRef: React.MutableRefObject<
    Map<string, ToolCallGroupExpansionState>
  >;
  handleGroupExpansionChange: (
    groupId: string,
    state: ToolCallGroupExpansionState,
  ) => void;
  allContentParts: TMessageContentParts[];
  renderPartFn: (
    part: TMessageContentParts,
    idx: number,
    isLastPart: boolean,
    onToolExpand?: () => void,
  ) => React.ReactNode;
  searchCtxValue: SearchContextValue;
};

const ContentFromState = memo(function ContentFromState({
  state,
  toolGroupExpansionRef,
  handleGroupExpansionChange,
  allContentParts,
  renderPartFn,
  searchCtxValue,
}: ContentFromStateProps) {
  const localize = useLocalize();
  const lastContentIdx = Math.max(0, allContentParts.length - 1);

  const pendingSkills = state.pendingSkills;
  const hasPendingSkills = state.hasPendingSkills;

  const renderPendingSkills = () =>
    pendingSkills.map((name) => (
      <PendingSkillCall
        key={`pending-skill-${name}`}
        skillName={name}
        loaded={state.hasRealContent}
      />
    ));

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

  if (state.status === MessageRenderStatus.EDITING) {
    if (!state.setCurrentEditId || !state.setSiblingIdx) {
      return null;
    }
    return (
      <>
        {allContentParts.map((part, idx) => {
          if (!part) return null;
          const isTextPart =
            part?.type === ContentTypes.TEXT ||
            typeof (part as unknown as any)?.text === 'string';
          const isThinkPart =
            part?.type === ContentTypes.THINK ||
            typeof (part as unknown as any)?.think === 'string';
          if (!isTextPart && !isThinkPart) return null;
          const isToolCall = part.type === ContentTypes.TOOL_CALL || (part as any)['tool_call_ids'] != null;
          if (isToolCall) return null;
          return (
            <EditTextPart
              index={idx}
              part={part as any}
              messageId={state.messageId}
              isSubmitting={state.isSubmitting}
              enterEdit={state.actions.enterEdit}
              siblingIdx={state.siblingIdx ?? null}
              setSiblingIdx={(v: number) => {
                if (state.setSiblingIdx) {
                  state.setSiblingIdx(v);
                }
              }}
              key={`edit-${state.messageId}-${idx}`}
            />
          );
        })}
      </>
    );
  }

  const attachmentsForGroup: TAttachment[] = state.attachments.map(
    (a) => a.attachment,
  );

  if (state.hasParallelContent) {
    return (
      <>
        {hasPendingSkills && renderPendingSkills()}
        <ParallelContentRenderer
          content={allContentParts}
          messageId={state.messageId}
          conversationId={state.conversationId}
          attachments={attachmentsForGroup}
          searchResults={searchCtxValue.searchResults as any}
          isSubmitting={state.isSubmitting}
          renderPart={renderPartFn}
        />
      </>
    );
  }

  const attachmentsList = state.attachments.map((a) => a.attachment);

  return (
    <SearchContext.Provider value={searchCtxValue}>
      <MemoryArtifacts attachments={attachmentsForGroup} />
      {hasPendingSkills && renderPendingSkills()}
      {state.showEmptyCursor && (
        <Container>
          <EmptyText />
        </Container>
      )}
      {state.toolCallGroups.length > 0 ? (
        renderWithGroups(
          state,
          toolGroupExpansionRef,
          handleGroupExpansionChange,
          allContentParts,
          renderPartFn,
          lastContentIdx,
          attachmentsList,
        )
      ) : (
        state.blocks.map((block, idx) => (
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
        ))
      )}
    </SearchContext.Provider>
  );
});

function renderWithGroups(
  state: MessageRenderState,
  toolGroupExpansionRef: React.MutableRefObject<
    Map<string, ToolCallGroupExpansionState>
  >,
  handleGroupExpansionChange: (
    groupId: string,
    s: ToolCallGroupExpansionState,
  ) => void,
  allContentParts: TMessageContentParts[],
  renderPartFn: (
    part: TMessageContentParts,
    idx: number,
    isLastPart: boolean,
    onToolExpand?: () => void,
  ) => React.ReactNode,
  lastContentIdx: number,
  attachmentsList: TAttachment[],
): React.ReactNode {
  const groupIdSet = new Set(
    state.toolCallGroups.flatMap((g) => g.parts.map((p) => p.idx)),
  );

  const result: React.ReactNode[] = [];
  let blockCursor = 0;
  let groupCursor = 0;

  for (let i = 0; i < allContentParts.length; i++) {
    if (groupIdSet.has(i)) {
      if (state.blocks[blockCursor] && state.blocks[blockCursor].partIndex < i) {
        result.push(
          <BlockRenderer
            key={state.blocks[blockCursor].id}
            block={state.blocks[blockCursor]}
            messageId={state.messageId}
            conversationId={state.conversationId}
            isSubmitting={state.isSubmitting}
            isLatestMessage={state.isLatestMessage}
            isCreatedByUser={state.isCreatedByUser}
            isLast={false}
          />,
        );
        blockCursor++;
      }
      const group = state.toolCallGroups[groupCursor];
      if (group) {
        result.push(
          <ToolCallGroup
            key={`tool-group-${group.groupId}`}
            parts={group.parts}
            isSubmitting={group.isSubmitting}
            isLast={group.isLast}
            renderPart={renderPartFn}
            lastContentIdx={lastContentIdx}
            groupAttachments={group.groupAttachments}
            initialExpansionState={toolGroupExpansionRef.current.get(group.groupId)}
            onExpansionChange={(s) => handleGroupExpansionChange(group.groupId, s)}
          />,
        );
        groupCursor++;
        i = Math.max(i, ...group.parts.map((p) => p.idx));
      }
    } else {
      if (state.blocks[blockCursor]) {
        const b = state.blocks[blockCursor];
        result.push(
          <BlockRenderer
            key={b.id}
            block={b}
            messageId={state.messageId}
            conversationId={state.conversationId}
            isSubmitting={state.isSubmitting}
            isLatestMessage={state.isLatestMessage}
            isCreatedByUser={state.isCreatedByUser}
            isLast={blockCursor === state.blocks.length - 1}
          />,
        );
        blockCursor++;
      }
    }
  }

  return <>{result}</>;
}

type RenderedMessageProps = {
  state: MessageRenderState;
  conversation?: any;
  messageChildren?: any[];
  toolGroupExpansionRef: React.MutableRefObject<
    Map<string, ToolCallGroupExpansionState>
  >;
  handleGroupExpansionChange: (
    groupId: string,
    s: ToolCallGroupExpansionState,
  ) => void;
  allContentParts: TMessageContentParts[];
  renderPartFn: (
    part: TMessageContentParts,
    idx: number,
    isLastPart: boolean,
    onToolExpand?: () => void,
  ) => React.ReactNode;
};

const RenderedMessage = memo(function RenderedMessage({
  state,
  conversation,
  messageChildren,
  toolGroupExpansionRef,
  handleGroupExpansionChange,
  allContentParts,
  renderPartFn,
}: RenderedMessageProps) {
  const localize = useLocalize();
  const fontSize = useAtomValue(fontSizeAtom);
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
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

  const searchCtxValue: SearchContextValue = useMemo(
    () => ({ searchResults: state.searchResults as any }),
    [state.searchResults],
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
                  {
                    messageId: state.messageId,
                    isCreatedByUser: state.isCreatedByUser,
                  } as any,
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
                  <ContentFromState
                    state={state}
                    toolGroupExpansionRef={toolGroupExpansionRef}
                    handleGroupExpansionChange={handleGroupExpansionChange}
                    allContentParts={allContentParts}
                    renderPartFn={renderPartFn}
                    searchCtxValue={searchCtxValue}
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
ContentFromState.displayName = 'ContentFromState';

export { RenderedMessage, ContentFromState, BlockRenderer };
