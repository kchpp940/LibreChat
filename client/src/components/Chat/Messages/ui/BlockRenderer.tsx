import { memo, useMemo } from 'react';
import { ContentTypes } from 'librechat-data-provider';
import {
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
} from '~/components/Chat/Messages/Content/Parts';
import { ImageGen } from '~/components/Chat/Messages/Content/Parts/OpenAIImageGen';
import Container from '~/components/Chat/Messages/Content/Container';
import RetrievalCall from '~/components/Chat/Messages/Content/RetrievalCall';
import AgentHandoff from '~/components/Chat/Messages/Content/AgentHandoff';
import CodeAnalyze from '~/components/Chat/Messages/Content/CodeAnalyze';
import WebSearch from '~/components/Chat/Messages/Content/WebSearch';
import ToolCall from '~/components/Chat/Messages/Content/ToolCall';
import Image from '~/components/Chat/Messages/Content/Image';
import { ErrorMessage } from '~/components/Chat/Messages/Content/MessageContent';
import { MessageContext } from '~/Providers';

export type BlockRendererProps = {
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
}: BlockRendererProps): React.ReactNode {
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
            <Text text={b.text} isCreatedByUser={isCreatedByUser} showCursor={block.showCursor} />
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
        b.content != null ? [{ type: ContentTypes.TEXT, text: b.content }] : undefined;
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
          input = typeof b.args === 'string' ? b.args : '';
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

export const BlockRenderer = memo(BlockRendererInner);
