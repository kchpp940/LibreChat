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
import ToolMermaidArtifact from '../../Parts/ToolMermaidArtifact';
import ToolArtifactCard from '../../Parts/ToolArtifactCard';
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
import type { RenderableMatchInput } from '../../parser/types';
import { fileToArtifact, TOOL_ARTIFACT_TYPES } from '~/utils/artifacts';
import { useLocalize } from '~/hooks';
import type { ToolArtifactType } from '~/utils/artifacts';
import FileAttachment from './FileAttachment';
import ImageAttachment from './ImageAttachment';
import TextAttachmentComponent from './TextAttachment';

type FileAuthoringToolName = 'create_file' | 'edit_file';
type AnyRecord = Record<string, unknown>;

const assertType = <T,>(v: unknown): T => v as T;
const asToolCall = (item: RenderableItem) => assertType<RenderableToolCall>(item);
const getOnExpand = (props: StandardRendererProps): (() => void) | undefined =>
  (props as StandardRendererProps & { onToolExpand?: () => void }).onToolExpand;

/* ────────────────────────────────────────────────────────
   Shared helpers
   ──────────────────────────────────────────────────────── */

const _default = (n: number | undefined, fallback: number) =>
  typeof n === 'number' ? n : fallback;

/* ────────────────────────────────────────────────────────
   Non-tool renderers (unchanged)
   ──────────────────────────────────────────────────────── */

const TextRenderer = memo(function TextRenderer(props: StandardRendererProps) {
  const item = assertType<RenderableText>(props.item);
  return (
    <Container>
      <Text
        text={item.text}
        isCreatedByUser={!!props.isCreatedByUser}
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
  return (
    <>
      <AgentUpdate currentAgentId={item.agentId} />
      {props.isLast && props.showCursor && (
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

/* ────────────────────────────────────────────────────────
   Tool call renderers — one per toolKind
   ──────────────────────────────────────────────────────── */

const BashProgrammaticRenderer = memo(function BashProgrammaticRenderer(
  props: StandardRendererProps,
) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <BashCall
      args={item.args as AnyRecord}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      commandField="code"
      hideAttachments={item.hideAttachments}
      onExpand={onExpand}
    />
  );
});

const ExecuteCodeRenderer = memo(function ExecuteCodeRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <ExecuteCode
      attachments={item.attachments}
      isSubmitting={!!item.isSubmitting}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      args={item.args}
      hideAttachments={item.hideAttachments}
      onExpand={onExpand}
    />
  );
});

const ImageGenRenderer = memo(function ImageGenRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  return (
    <ImageGen
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      toolName={item.toolName}
      args={typeof item.args === 'string' ? item.args : ''}
      output={item.output ?? ''}
      attachments={item.attachments}
      hideAttachments={item.hideAttachments}
    />
  );
});

const SkillRenderer = memo(function SkillRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <SkillCall
      args={item.args}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      hideAttachments={item.hideAttachments}
      onExpand={onExpand}
    />
  );
});

const SubagentRenderer = memo(function SubagentRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  return (
    <SubagentCall
      toolCallId={item.toolCallId ?? ''}
      args={item.args}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      hideAttachments={item.hideAttachments}
    />
  );
});

const ReadFileRenderer = memo(function ReadFileRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <ReadFileCall
      args={item.args}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      hideAttachments={item.hideAttachments}
      onExpand={onExpand}
    />
  );
});

const FileAuthoringRenderer = memo(function FileAuthoringRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <FileAuthoringCall
      toolName={item.toolName as FileAuthoringToolName}
      args={item.args}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      hideAttachments={item.hideAttachments}
      onExpand={onExpand}
    />
  );
});

const BashToolRenderer = memo(function BashToolRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <BashCall
      args={item.args as AnyRecord}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      hideAttachments={item.hideAttachments}
      onExpand={onExpand}
    />
  );
});

const WebSearchRenderer = memo(function WebSearchRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <WebSearch
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      isLast={item.isLast}
      onExpand={onExpand}
    />
  );
});

const RetrievalRenderer = memo(function RetrievalRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <RetrievalCall
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      output={item.output as string | undefined}
      attachments={item.attachments}
      onExpand={onExpand}
    />
  );
});

const AgentHandoffRenderer = memo(function AgentHandoffRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  return (
    <AgentHandoff
      args={(item.args ?? '') as string}
      name={String(item.toolName || '')}
    />
  );
});

const CodeInterpreterRenderer = memo(function CodeInterpreterRenderer(
  props: StandardRendererProps,
) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  const codeInterpreter = item.toolCall['code_interpreter' as string] as AnyRecord | undefined;
  const code = typeof codeInterpreter?.input === 'string' ? codeInterpreter.input : '';
  const outputs = Array.isArray(codeInterpreter?.outputs)
    ? (codeInterpreter.outputs as AnyRecord[])
    : [];
  return (
    <CodeAnalyze
      initialProgress={_default(item.initialProgress, 0.1)}
      code={code}
      outputs={outputs}
      onExpand={onExpand}
    />
  );
});

const ImageVisionRenderer = memo(function ImageVisionRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  if (item.isSubmitting && props.showCursor) {
    return (
      <Container>
        <Text text="" isCreatedByUser={!!props.isCreatedByUser} showCursor={!!props.showCursor} />
      </Container>
    );
  }
  return null;
});

const GenericToolRenderer = memo(function GenericToolRenderer(props: StandardRendererProps) {
  const item = asToolCall(props.item);
  const onExpand = getOnExpand(props);
  return (
    <ToolCall
      args={(item.args ?? '') as string}
      name={String(item.toolName || '')}
      output={item.output ?? ''}
      initialProgress={_default(item.initialProgress, 0.1)}
      isSubmitting={!!item.isSubmitting}
      attachments={item.attachments}
      auth={typeof item.auth === 'string' ? item.auth : undefined}
      isLast={item.isLast}
      hideAttachments={item.hideAttachments}
      onExpand={onExpand}
    />
  );
});

const FunctionCallRenderer = GenericToolRenderer;

/* ────────────────────────────────────────────────────────
   Attachment / artifact renderers (no internal switch)
   ──────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────
   Helper: build a toolKind matcher with explicit priority
   ──────────────────────────────────────────────────────── */

const toolMatch = (toolKind: string) => (input: RenderableMatchInput) => ({
  matched: input.kind === 'tool_call' && (input as { toolKind?: string }).toolKind === toolKind,
});

/* ────────────────────────────────────────────────────────
   Standard renderer registry
   ──────────────────────────────────────────────────────── */

export const standardRenderers: StandardRenderer[] = [
  /* ── content parts ── */
  {
    id: 'text',
    name: 'Text / Markdown Content',
    kind: 'text',
    priority: 10,
    match: (input) => ({ matched: input.kind === 'text' }),
    render: TextRenderer,
  },
  {
    id: 'think',
    name: 'Reasoning / Thinking Block',
    kind: 'think',
    priority: 90,
    match: (input) => ({ matched: input.kind === 'think' }),
    render: ThinkRenderer,
  },
  {
    id: 'image',
    name: 'Image Content Part',
    kind: 'image',
    priority: 80,
    match: (input) => ({ matched: input.kind === 'image' }),
    render: ImageRenderer,
  },
  {
    id: 'error',
    name: 'Error Content Part',
    kind: 'error',
    priority: 100,
    match: (input) => ({ matched: input.kind === 'error' }),
    render: ErrorRenderer,
  },
  {
    id: 'summary',
    name: 'Summary Content Part',
    kind: 'summary',
    priority: 85,
    match: (input) => ({ matched: input.kind === 'summary' }),
    render: SummaryRenderer,
  },
  {
    id: 'agent_update',
    name: 'Agent Transition Indicator',
    kind: 'agent_update',
    priority: 95,
    match: (input) => ({ matched: input.kind === 'agent_update' }),
    render: AgentUpdateRenderer,
  },
  {
    id: 'empty_cursor',
    name: 'Empty Streaming Cursor',
    kind: 'empty_cursor',
    priority: 5,
    match: (input) => ({ matched: input.kind === 'empty_cursor' }),
    render: EmptyCursorRenderer,
  },
  {
    id: 'pending_skill',
    name: 'Pending Skill Loading Card',
    kind: 'pending_skill',
    priority: 50,
    match: (input) => ({ matched: input.kind === 'pending_skill' }),
    render: PendingSkillRenderer,
  },

  /* ── tool calls: one renderer per toolKind, priority ensures specificity ── */
  {
    id: 'tool_bash_programmatic',
    name: 'Bash (programmatic, internal)',
    kind: 'tool_call',
    priority: 300,
    match: toolMatch('bash_programmatic'),
    render: BashProgrammaticRenderer,
  },
  {
    id: 'tool_execute_code',
    name: 'Code Execution (programmatic)',
    kind: 'tool_call',
    priority: 280,
    match: toolMatch('execute_code'),
    render: ExecuteCodeRenderer,
  },
  {
    id: 'tool_image_gen',
    name: 'Image Generation Tool',
    kind: 'tool_call',
    priority: 260,
    match: toolMatch('image_gen'),
    render: ImageGenRenderer,
  },
  {
    id: 'tool_skill',
    name: 'Skill Invocation',
    kind: 'tool_call',
    priority: 250,
    match: toolMatch('skill'),
    render: SkillRenderer,
  },
  {
    id: 'tool_subagent',
    name: 'Subagent / Handoff Task',
    kind: 'tool_call',
    priority: 240,
    match: toolMatch('subagent'),
    render: SubagentRenderer,
  },
  {
    id: 'tool_read_file',
    name: 'Read File Tool',
    kind: 'tool_call',
    priority: 230,
    match: toolMatch('read_file'),
    render: ReadFileRenderer,
  },
  {
    id: 'tool_file_authoring',
    name: 'Create / Edit File Tool',
    kind: 'tool_call',
    priority: 220,
    match: toolMatch('file_authoring'),
    render: FileAuthoringRenderer,
  },
  {
    id: 'tool_bash_tool',
    name: 'Explicit Bash Tool',
    kind: 'tool_call',
    priority: 210,
    match: toolMatch('bash_tool'),
    render: BashToolRenderer,
  },
  {
    id: 'tool_web_search',
    name: 'Web Search Tool',
    kind: 'tool_call',
    priority: 200,
    match: toolMatch('web_search'),
    render: WebSearchRenderer,
  },
  {
    id: 'tool_retrieval',
    name: 'Retrieval / File Search Tool',
    kind: 'tool_call',
    priority: 190,
    match: toolMatch('retrieval'),
    render: RetrievalRenderer,
  },
  {
    id: 'tool_agent_handoff',
    name: 'Agent Handoff (LC transfer)',
    kind: 'tool_call',
    priority: 180,
    match: toolMatch('agent_handoff'),
    render: AgentHandoffRenderer,
  },
  {
    id: 'tool_code_interpreter',
    name: 'Code Interpreter (OpenAI)',
    kind: 'tool_call',
    priority: 170,
    match: toolMatch('code_interpreter'),
    render: CodeInterpreterRenderer,
  },
  {
    id: 'tool_image_vision',
    name: 'Image Vision (no UI while submitting)',
    kind: 'tool_call',
    priority: 160,
    match: toolMatch('image_vision'),
    render: ImageVisionRenderer,
  },
  {
    id: 'tool_function_call',
    name: 'Raw Function Call (legacy)',
    kind: 'tool_call',
    priority: 120,
    match: toolMatch('function_call'),
    render: FunctionCallRenderer,
  },
  {
    id: 'tool_generic',
    name: 'Generic Tool Fallback',
    kind: 'tool_call',
    priority: 100,
    match: (input) => ({ matched: input.kind === 'tool_call' }),
    render: GenericToolRenderer,
  },

  /* ── attachments ── */
  {
    id: 'attachment_image',
    name: 'Image Attachment Preview',
    kind: 'attachment',
    priority: 200,
    match: (input) => ({
      matched: input.kind === 'attachment' && (input as { attachmentType?: string }).attachmentType === 'image',
    }),
    render: ImageAttachmentRenderer,
  },
  {
    id: 'attachment_text',
    name: 'Text Attachment Inline',
    kind: 'attachment',
    priority: 150,
    match: (input) => ({
      matched: input.kind === 'attachment' && (input as { attachmentType?: string }).attachmentType === 'text',
    }),
    render: TextAttachmentRenderer,
  },
  {
    id: 'attachment_file',
    name: 'File Attachment (fallback download)',
    kind: 'attachment',
    priority: 100,
    match: (input) => ({
      matched: input.kind === 'attachment' && (input as { attachmentType?: string }).attachmentType === 'file',
    }),
    render: FileAttachmentRenderer,
  },

  /* ── artifacts ── */
  {
    id: 'artifact_mermaid',
    name: 'Mermaid Chart Artifact',
    kind: 'artifact',
    priority: 180,
    match: (input) => ({
      matched: input.kind === 'artifact' &&
        (input as { artifactType?: string }).artifactType === TOOL_ARTIFACT_TYPES.MERMAID,
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
