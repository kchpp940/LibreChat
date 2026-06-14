import { memo } from 'react';
import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import { Tools, Constants, ToolCallTypes, imageGenTools, isImageVisionTool } from 'librechat-data-provider';
import type { ToolCallRenderer, ToolCallRendererProps } from './types';
import {
  ImageGen,
  ExecuteCode,
  SkillCall,
  ReadFileCall,
  FileAuthoringCall,
  BashCall,
  SubagentCall,
  Text,
} from '../Parts';
import RetrievalCall from '../RetrievalCall';
import AgentHandoff from '../AgentHandoff';
import CodeAnalyze from '../CodeAnalyze';
import Container from '../Container';
import WebSearch from '../WebSearch';
import ToolCall from '../ToolCall';
import { isBashProgrammaticToolCall } from '../routing';
type FileAuthoringToolName = 'create_file' | 'edit_file';

type AnyRecord = Record<string, unknown>;

type ToolCallMatchInput = { toolName: string; toolCall: AnyRecord };

const getToolCallField = (toolCall: AnyRecord, field: string): unknown => {
  return (toolCall as AnyRecord)[field];
};

const getAsToolCallWithFunction = (toolCall: AnyRecord): AnyRecord & { function?: AnyRecord } => {
  return toolCall as AnyRecord & { function?: AnyRecord };
};

const matchByName = (toolName: string, names: string | string[]) => {
  const nameList = Array.isArray(names) ? names : [names];
  return nameList.includes(toolName);
};

const BashProgrammaticRenderer = memo(function BashProgrammaticRenderer(props: ToolCallRendererProps) {
  const { args, output, initialProgress, isSubmitting, attachments, hideAttachments, onToolExpand } = props;
  return (
    <BashCall
      args={args as AnyRecord}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      commandField="code"
      hideAttachments={hideAttachments}
      onExpand={onToolExpand}
    />
  );
});

const ExecuteCodeRenderer = memo(function ExecuteCodeRenderer(props: ToolCallRendererProps) {
  const { args, output, initialProgress, isSubmitting, attachments, hideAttachments, onToolExpand } = props;
  return (
    <ExecuteCode
      attachments={attachments}
      isSubmitting={isSubmitting}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      args={args}
      hideAttachments={hideAttachments}
      onExpand={onToolExpand}
    />
  );
});

const ImageGenRenderer = memo(function ImageGenRenderer(props: ToolCallRendererProps) {
  const { toolName, args, output, initialProgress, isSubmitting, attachments, hideAttachments } = props;
  return (
    <ImageGen
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      toolName={toolName}
      args={typeof args === 'string' ? args : ''}
      output={output ?? ''}
      attachments={attachments}
      hideAttachments={hideAttachments}
    />
  );
});

const SkillCallRenderer = memo(function SkillCallRenderer(props: ToolCallRendererProps) {
  const { args, output, initialProgress, isSubmitting, attachments, hideAttachments, onToolExpand } = props;
  return (
    <SkillCall
      args={args}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      hideAttachments={hideAttachments}
      onExpand={onToolExpand}
    />
  );
});

const SubagentRenderer = memo(function SubagentRenderer(props: ToolCallRendererProps) {
  const { toolCall, args, output, initialProgress, isSubmitting, attachments, hideAttachments } = props;
  const persistedContent = (toolCall as unknown as {
    subagent_content?: TMessageContentParts[];
  }).subagent_content;
  const toolCallId = String(getToolCallField(toolCall, 'id') ?? '');
  return (
    <SubagentCall
      toolCallId={toolCallId}
      args={args}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      persistedContent={persistedContent}
      hideAttachments={hideAttachments}
    />
  );
});

const ReadFileRenderer = memo(function ReadFileRenderer(props: ToolCallRendererProps) {
  const { args, output, initialProgress, isSubmitting, attachments, hideAttachments, onToolExpand } = props;
  return (
    <ReadFileCall
      args={args}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      hideAttachments={hideAttachments}
      onExpand={onToolExpand}
    />
  );
});

const FileAuthoringRenderer = memo(function FileAuthoringRenderer(props: ToolCallRendererProps) {
  const { toolName, args, output, initialProgress, isSubmitting, attachments, hideAttachments, onToolExpand } = props;
  return (
    <FileAuthoringCall
      toolName={toolName as FileAuthoringToolName}
      args={args}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      hideAttachments={hideAttachments}
      onExpand={onToolExpand}
    />
  );
});

const BashToolRenderer = memo(function BashToolRenderer(props: ToolCallRendererProps) {
  const { args, output, initialProgress, isSubmitting, attachments, hideAttachments, onToolExpand } = props;
  return (
    <BashCall
      args={args as AnyRecord}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      hideAttachments={hideAttachments}
      onExpand={onToolExpand}
    />
  );
});

const WebSearchRenderer = memo(function WebSearchRenderer(props: ToolCallRendererProps) {
  const { output, initialProgress, isSubmitting, attachments, isLast, onToolExpand } = props;
  return (
    <WebSearch
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      isLast={isLast}
      onExpand={onToolExpand}
    />
  );
});

const RetrievalRenderer = memo(function RetrievalRenderer(props: ToolCallRendererProps) {
  const { output, initialProgress, isSubmitting, attachments, onToolExpand } = props;
  return (
    <RetrievalCall
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      output={output as string | undefined}
      attachments={attachments}
      onExpand={onToolExpand}
    />
  );
});

const AgentHandoffRenderer = memo(function AgentHandoffRenderer(props: ToolCallRendererProps) {
  const { toolName, args } = props;
  return <AgentHandoff args={(args ?? '') as string} name={String(toolName || '')} />;
});

const CodeInterpreterRenderer = memo(function CodeInterpreterRenderer(props: ToolCallRendererProps) {
  const { toolCall, initialProgress, onToolExpand } = props;
  const codeInterpreter = getToolCallField(toolCall, ToolCallTypes.CODE_INTERPRETER) as AnyRecord | undefined;
  const input = typeof codeInterpreter?.input === 'string' ? codeInterpreter.input : '';
  const outputs = Array.isArray(codeInterpreter?.outputs) ? (codeInterpreter.outputs as AnyRecord[]) : [];
  return (
    <CodeAnalyze
      initialProgress={initialProgress ?? 0.1}
      code={input}
      outputs={outputs}
      onExpand={onToolExpand}
    />
  );
});

const GenericToolCallRenderer = memo(function GenericToolCallRenderer(props: ToolCallRendererProps) {
  const { toolName, args, output, initialProgress, isSubmitting, attachments, auth, isLast, hideAttachments, onToolExpand } = props;
  return (
    <ToolCall
      args={(args ?? '') as string}
      name={String(toolName || '')}
      output={output ?? ''}
      initialProgress={initialProgress ?? 0.1}
      isSubmitting={isSubmitting}
      attachments={attachments}
      auth={typeof auth === 'string' ? auth : undefined}
      isLast={isLast}
      hideAttachments={hideAttachments}
      onExpand={onToolExpand}
    />
  );
});

export const toolCallRenderers: ToolCallRenderer[] = [
  {
    id: 'tool-bash-programmatic',
    name: 'Bash Programmatic Tool Call',
    priority: 200,
    match: (input: ToolCallMatchInput) => {
      const { toolName, toolCall } = input;
      const args = getToolCallField(toolCall, 'args');
      if (isBashProgrammaticToolCall(toolName, args as string | AnyRecord)) {
        return { matched: true, priority: 200 };
      }
      return { matched: false };
    },
    render: BashProgrammaticRenderer,
  },
  {
    id: 'tool-execute-code',
    name: 'Execute Code',
    priority: 190,
    match: (input: ToolCallMatchInput) => ({
      matched: matchByName(input.toolName, [
        String(Tools.execute_code),
        String(Constants.PROGRAMMATIC_TOOL_CALLING),
        String(Constants.BASH_PROGRAMMATIC_TOOL_CALLING),
      ]),
    }),
    render: ExecuteCodeRenderer,
  },
  {
    id: 'tool-image-gen',
    name: 'Image Generation',
    priority: 180,
    match: (input: ToolCallMatchInput) => ({
      matched: matchByName(input.toolName, ['image_gen_oai', 'image_edit_oai', 'gemini_image_gen']),
    }),
    render: ImageGenRenderer,
  },
  {
    id: 'tool-skill',
    name: 'Skill Call',
    priority: 170,
    match: (input: ToolCallMatchInput) => ({ matched: input.toolName === 'skill' }),
    render: SkillCallRenderer,
  },
  {
    id: 'tool-subagent',
    name: 'Subagent Call',
    priority: 165,
    match: (input: ToolCallMatchInput) => ({
      matched: input.toolName === String(Constants.SUBAGENT),
    }),
    render: SubagentRenderer,
  },
  {
    id: 'tool-read-file',
    name: 'Read File',
    priority: 160,
    match: (input: ToolCallMatchInput) => ({ matched: input.toolName === 'read_file' }),
    render: ReadFileRenderer,
  },
  {
    id: 'tool-file-authoring',
    name: 'File Authoring',
    priority: 155,
    match: (input: ToolCallMatchInput) => ({
      matched: matchByName(input.toolName, ['create_file', 'edit_file']),
    }),
    render: FileAuthoringRenderer,
  },
  {
    id: 'tool-bash',
    name: 'Bash Tool',
    priority: 150,
    match: (input: ToolCallMatchInput) => ({
      matched: input.toolName === String(Tools.bash_tool),
    }),
    render: BashToolRenderer,
  },
  {
    id: 'tool-web-search',
    name: 'Web Search',
    priority: 145,
    match: (input: ToolCallMatchInput) => ({
      matched: input.toolName === String(Tools.web_search),
    }),
    render: WebSearchRenderer,
  },
  {
    id: 'tool-retrieval',
    name: 'Retrieval / File Search',
    priority: 140,
    match: (input: ToolCallMatchInput) => ({
      matched: matchByName(input.toolName, ['file_search', 'retrieval']),
    }),
    render: RetrievalRenderer,
  },
  {
    id: 'tool-agent-handoff',
    name: 'Agent Handoff (LC Transfer)',
    priority: 135,
    match: (input: ToolCallMatchInput) => ({
      matched: String(input.toolName).startsWith(String(Constants.LC_TRANSFER_TO_)),
    }),
    render: AgentHandoffRenderer,
  },
  {
    id: 'tool-code-interpreter',
    name: 'Code Interpreter (Assistants)',
    priority: 130,
    match: (input: ToolCallMatchInput) => {
      const callType = getToolCallField(input.toolCall, 'type');
      return { matched: callType === ToolCallTypes.CODE_INTERPRETER };
    },
    render: CodeInterpreterRenderer,
  },
  {
    id: 'tool-retrieval-type',
    name: 'Retrieval / File Search (Assistants Type)',
    priority: 125,
    match: (input: ToolCallMatchInput) => {
      const callType = getToolCallField(input.toolCall, 'type');
      return {
        matched:
          callType === ToolCallTypes.RETRIEVAL || callType === ToolCallTypes.FILE_SEARCH,
      };
    },
    render: RetrievalRenderer,
  },
  {
    id: 'tool-function-image-gen',
    name: 'Function Image Generation (Assistants)',
    priority: 120,
    match: (input: ToolCallMatchInput) => {
      const call = input.toolCall;
      const callType = getToolCallField(call, 'type');
      if (callType === ToolCallTypes.FUNCTION && ToolCallTypes.FUNCTION in call) {
        const withFunc = getAsToolCallWithFunction(call);
        const funcName = String(withFunc.function?.name ?? '');
        if (funcName && imageGenTools.has(funcName)) {
          return { matched: true };
        }
      }
      return { matched: false };
    },
    render: ImageGenRenderer,
  },
  {
    id: 'tool-image-vision-skip',
    name: 'Image Vision Tool (No Render)',
    priority: 115,
    match: (input: ToolCallMatchInput) => {
      const call = input.toolCall;
      const callType = getToolCallField(call, 'type');
      if (callType === ToolCallTypes.FUNCTION && ToolCallTypes.FUNCTION in call) {
        return { matched: isImageVisionTool(call as never) };
      }
      return { matched: false };
    },
    render: memo(function ImageVisionSkipRenderer(props: ToolCallRendererProps & { isSubmitting?: boolean; showCursor?: boolean; isCreatedByUser?: boolean }) {
      const extra = props as unknown as { isSubmitting?: boolean; showCursor?: boolean; isCreatedByUser?: boolean };
      if (extra.isSubmitting && extra.showCursor) {
        return (
          <Container>
            <Text text={''} isCreatedByUser={!!extra.isCreatedByUser} showCursor={extra.showCursor ?? false} />
          </Container>
        );
      }
      return null;
    }),
  },
  {
    id: 'tool-generic-function',
    name: 'Generic Function Call (Assistants)',
    priority: 110,
    match: (input: ToolCallMatchInput) => {
      const call = input.toolCall;
      const callType = getToolCallField(call, 'type');
      return {
        matched: callType === ToolCallTypes.FUNCTION && ToolCallTypes.FUNCTION in call,
      };
    },
    render: GenericToolCallRenderer,
  },
  {
    id: 'tool-generic',
    name: 'Generic Tool Call (Fallback)',
    priority: 0,
    match: (_input: ToolCallMatchInput) => ({ matched: true }),
    render: GenericToolCallRenderer,
  },
];

export default toolCallRenderers;
