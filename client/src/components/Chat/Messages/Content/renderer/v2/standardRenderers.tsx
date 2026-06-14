import { memo } from 'react';
import {
  AgentUpdate,
  EmptyText,
  Reasoning,
  Summary,
  Text,
  ImageGen,
  ExecuteCode,
  SkillCall,
  ReadFileCall,
  FileAuthoringCall,
  BashCall,
  SubagentCall,
} from '../../Parts';
import RetrievalCall from '../../RetrievalCall';
import AgentHandoff from '../../AgentHandoff';
import CodeAnalyze from '../../CodeAnalyze';
import Container from '../../Container';
import WebSearch from '../../WebSearch';
import ToolCall from '../../ToolCall';
import Image from '../../Image';
import { ErrorMessage } from '../../MessageContent';
import PendingSkillCall from '../../Parts/PendingSkillCall';
import type {
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
} from '../../parser/types';
import type { StandardRenderer, StandardRendererProps } from './types';
type FileAuthoringToolName = 'create_file' | 'edit_file';
import ToolMermaidArtifact from '../../Parts/ToolMermaidArtifact';
import ToolArtifactCard from '../../Parts/ToolArtifactCard';
import { fileToArtifact, TOOL_ARTIFACT_TYPES } from '~/utils/artifacts';
import { useLocalize } from '~/hooks';
import type { ToolArtifactType } from '~/utils/artifacts';
import FileAttachment from './FileAttachment';
import ImageAttachment from './ImageAttachment';
import TextAttachmentComponent from './TextAttachment';

const assertType = <T,>(v: unknown): T => v as T;

const TextRenderer = memo(function TextRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableText>(props.item);
  const { isCreatedByUser = false } = props;
  return (
    <Container>
      <Text
        text={item.text}
        isCreatedByUser={isCreatedByUser}
        showCursor={!!item.showCursor}
      />
    </Container>
  );
});

const ThinkRenderer = memo(function ThinkRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableThink>(props.item);
  return <Reasoning reasoning={item.reasoning} isLast={!!item.isLast} />;
});

const ImageRenderer = memo(function ImageRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableImage>(props.item);
  return (
    <Image
      imagePath={item.imagePath}
      altText={item.altText}
      width={item.width}
      height={item.height}
    />
  );
});

const ErrorRenderer = memo(function ErrorRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableError>(props.item);
  return <ErrorMessage text={item.text} className="my-2" />;
});

const SummaryRenderer = memo(function SummaryRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableSummary>(props.item);
  return (
    <Summary
      content={item.content as never}
      model={item.model}
      provider={item.provider}
      tokenCount={item.tokenCount}
      summarizing={item.summarizing}
    />
  );
});

const AgentUpdateRenderer = memo(function AgentUpdateRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableAgentUpdate>(props.item);
  const { isLast, showCursor } = props;
  return (
    <>
      <AgentUpdate currentAgentId={item.agentId} />
      {isLast && showCursor && (
        <Container>
          <EmptyText />
        </Container>
      )}
    </>
  );
});

const EmptyCursorRenderer = memo(function EmptyCursorRenderer() {
  return (
    <Container>
      <EmptyText />
    </Container>
  );
});

const PendingSkillRenderer = memo(function PendingSkillRenderer(props: StandardRendererProps) {
  const item = assertType<RenderablePendingSkill>(props.item);
  return <PendingSkillCall skillName={item.skillName} loaded={item.loaded} />;
});

const ToolCallRendererComponent = memo(function ToolCallRendererComponent(
  props: StandardRendererProps,
) {
  const item = assertType<RenderableToolCall>(props.item);
  const { onToolExpand } = props as StandardRendererProps & { onToolExpand?: () => void };

  switch (item.toolKind) {
    case 'bash_programmatic':
      return (
        <BashCall
          args={item.args as Record<string, unknown>}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          commandField="code"
          hideAttachments={item.hideAttachments}
          onExpand={onToolExpand}
        />
      );
    case 'execute_code':
      return (
        <ExecuteCode
          attachments={item.attachments}
          isSubmitting={!!item.isSubmitting}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          args={item.args}
          hideAttachments={item.hideAttachments}
          onExpand={onToolExpand}
        />
      );
    case 'image_gen':
      return (
        <ImageGen
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          toolName={item.toolName}
          args={typeof item.args === 'string' ? item.args : ''}
          output={item.output ?? ''}
          attachments={item.attachments}
          hideAttachments={item.hideAttachments}
        />
      );
    case 'skill':
      return (
        <SkillCall
          args={item.args}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          hideAttachments={item.hideAttachments}
          onExpand={onToolExpand}
        />
      );
    case 'subagent':
      return (
        <SubagentCall
          toolCallId={item.toolCallId ?? ''}
          args={item.args}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          hideAttachments={item.hideAttachments}
        />
      );
    case 'read_file':
      return (
        <ReadFileCall
          args={item.args}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          hideAttachments={item.hideAttachments}
          onExpand={onToolExpand}
        />
      );
    case 'file_authoring':
      return (
        <FileAuthoringCall
          toolName={item.toolName as FileAuthoringToolName}
          args={item.args}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          hideAttachments={item.hideAttachments}
          onExpand={onToolExpand}
        />
      );
    case 'bash_tool':
      return (
        <BashCall
          args={item.args as Record<string, unknown>}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          hideAttachments={item.hideAttachments}
          onExpand={onToolExpand}
        />
      );
    case 'web_search':
      return (
        <WebSearch
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          isLast={item.isLast}
          onExpand={onToolExpand}
        />
      );
    case 'retrieval':
      return (
        <RetrievalCall
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          output={item.output as string | undefined}
          attachments={item.attachments}
          onExpand={onToolExpand}
        />
      );
    case 'agent_handoff':
      return <AgentHandoff args={(item.args ?? '') as string} name={String(item.toolName || '')} />;
    case 'code_interpreter': {
      const codeInterpreter = item.toolCall[
        'code_interpreter' as string
      ] as Record<string, unknown> | undefined;
      const code = typeof codeInterpreter?.input === 'string' ? codeInterpreter.input : '';
      const outputs = Array.isArray(codeInterpreter?.outputs)
        ? (codeInterpreter.outputs as Record<string, unknown>[])
        : [];
      return (
        <CodeAnalyze
          initialProgress={item.initialProgress ?? 0.1}
          code={code}
          outputs={outputs}
          onExpand={onToolExpand}
        />
      );
    }
    case 'image_vision':
      if (item.isSubmitting && props.showCursor) {
        return (
          <Container>
            <Text text={''} isCreatedByUser={!!props.isCreatedByUser} showCursor={!!props.showCursor} />
          </Container>
        );
      }
      return null;
    default:
      return (
        <ToolCall
          args={(item.args ?? '') as string}
          name={String(item.toolName || '')}
          output={item.output ?? ''}
          initialProgress={item.initialProgress ?? 0.1}
          isSubmitting={!!item.isSubmitting}
          attachments={item.attachments}
          auth={typeof item.auth === 'string' ? item.auth : undefined}
          isLast={item.isLast}
          hideAttachments={item.hideAttachments}
          onExpand={onToolExpand}
        />
      );
  }
});

const ImageAttachmentRenderer = memo(function ImageAttachmentRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableAttachment>(props.item);
  return <ImageAttachment attachment={item.attachment} />;
});

const TextAttachmentRenderer = memo(function TextAttachmentRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableAttachment>(props.item);
  return <TextAttachmentComponent attachment={item.attachment} />;
});

const FileAttachmentRenderer = memo(function FileAttachmentRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableAttachment>(props.item);
  if (!item.attachment.filepath) return null;
  return <FileAttachment attachment={item.attachment} />;
});

const MermaidArtifactRenderer = memo(function MermaidArtifactRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableArtifact>(props.item);
  const file = item.attachment as { text?: string };
  if (!file.text) return null;
  return <ToolMermaidArtifact attachment={item.attachment} text={file.text} />;
});

const PanelArtifactRenderer = memo(function PanelArtifactRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableArtifact>(props.item);
  const localize = useLocalize();
  const placeholder = localize('com_ui_artifact_preview_pending');
  const artifact = fileToArtifact(item.attachment as never, {
    placeholder,
    preClassifiedType: item.artifactType as ToolArtifactType,
  });
  if (!artifact) return null;
  return <ToolArtifactCard attachment={item.attachment} artifact={artifact} />;
});

export const standardRenderers: StandardRenderer[] = [
  {
    id: 'text',
    name: 'Text Content',
    kind: 'text',
    priority: 10,
    match: (input) => ({ matched: input.kind === 'text' }),
    render: TextRenderer,
  },
  {
    id: 'think',
    name: 'Reasoning / Thinking',
    kind: 'think',
    priority: 90,
    match: (input) => ({ matched: input.kind === 'think' }),
    render: ThinkRenderer,
  },
  {
    id: 'image',
    name: 'Image Content',
    kind: 'image',
    priority: 80,
    match: (input) => ({ matched: input.kind === 'image' }),
    render: ImageRenderer,
  },
  {
    id: 'error',
    name: 'Error Content',
    kind: 'error',
    priority: 100,
    match: (input) => ({ matched: input.kind === 'error' }),
    render: ErrorRenderer,
  },
  {
    id: 'summary',
    name: 'Summary Content',
    kind: 'summary',
    priority: 85,
    match: (input) => ({ matched: input.kind === 'summary' }),
    render: SummaryRenderer,
  },
  {
    id: 'agent_update',
    name: 'Agent Update',
    kind: 'agent_update',
    priority: 95,
    match: (input) => ({ matched: input.kind === 'agent_update' }),
    render: AgentUpdateRenderer,
  },
  {
    id: 'empty_cursor',
    name: 'Empty Cursor Placeholder',
    kind: 'empty_cursor',
    priority: 5,
    match: (input) => ({ matched: input.kind === 'empty_cursor' }),
    render: EmptyCursorRenderer,
  },
  {
    id: 'pending_skill',
    name: 'Pending Skill Card',
    kind: 'pending_skill',
    priority: 50,
    match: (input) => ({ matched: input.kind === 'pending_skill' }),
    render: PendingSkillRenderer,
  },
  {
    id: 'tool_call',
    name: 'Tool Call (All Kinds)',
    kind: 'tool_call',
    priority: 70,
    match: (input) => ({ matched: input.kind === 'tool_call' }),
    render: ToolCallRendererComponent,
  },
  {
    id: 'attachment_image',
    name: 'Image Attachment',
    kind: 'attachment',
    priority: 200,
    match: (input) => ({
      matched: input.kind === 'attachment' && input.attachmentType === 'image',
    }),
    render: ImageAttachmentRenderer,
  },
  {
    id: 'attachment_text',
    name: 'Text Attachment (Inline)',
    kind: 'attachment',
    priority: 150,
    match: (input) => ({
      matched: input.kind === 'attachment' && input.attachmentType === 'text',
    }),
    render: TextAttachmentRenderer,
  },
  {
    id: 'attachment_file',
    name: 'Generic File Download (Fallback)',
    kind: 'attachment',
    priority: 100,
    match: (input) => ({
      matched: input.kind === 'attachment' && input.attachmentType === 'file',
    }),
    render: FileAttachmentRenderer,
  },
  {
    id: 'artifact_mermaid',
    name: 'Mermaid Artifact',
    kind: 'artifact',
    priority: 180,
    match: (input) => ({
      matched: input.kind === 'artifact' && input.artifactType === TOOL_ARTIFACT_TYPES.MERMAID,
    }),
    render: MermaidArtifactRenderer,
  },
  {
    id: 'artifact_panel',
    name: 'Panel Artifact (Spreadsheet, PDF, etc.)',
    kind: 'artifact',
    priority: 170,
    match: (input) => ({ matched: input.kind === 'artifact' }),
    render: PanelArtifactRenderer,
  },
];

export default standardRenderers;
