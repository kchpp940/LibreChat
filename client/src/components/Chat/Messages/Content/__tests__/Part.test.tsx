import React from 'react';
import { render, screen } from '@testing-library/react';
import { Constants, ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import Part from '../Part';

jest.mock('../Parts', () => ({
  ImageGen: () => <div data-testid="image-gen" />,
  ExecuteCode: () => <div data-testid="execute-code" />,
  AgentUpdate: () => <div data-testid="agent-update" />,
  EmptyText: () => <div data-testid="empty-text" />,
  Reasoning: () => <div data-testid="reasoning" />,
  Summary: () => <div data-testid="summary" />,
  Text: ({ text }: { text?: string }) => <div data-testid="text">{text}</div>,
  SkillCall: () => <div data-testid="skill-call" />,
  ReadFileCall: () => <div data-testid="read-file-call" />,
  FileAuthoringCall: ({ toolName }: { toolName: string }) => (
    <div data-testid="file-authoring-call" data-tool-name={toolName} />
  ),
  BashCall: ({ commandField }: { commandField?: string }) => (
    <div data-testid="bash-call" data-command-field={commandField ?? 'command'} />
  ),
  SubagentCall: () => <div data-testid="subagent-call" />,
}));

jest.mock('../MessageContent', () => ({
  ErrorMessage: () => <div data-testid="error-message" />,
}));

jest.mock('../RetrievalCall', () => ({
  __esModule: true,
  default: () => <div data-testid="retrieval-call" />,
}));

jest.mock('../AgentHandoff', () => ({
  __esModule: true,
  default: () => <div data-testid="agent-handoff" />,
}));

jest.mock('../CodeAnalyze', () => ({
  __esModule: true,
  default: () => <div data-testid="code-analyze" />,
}));

jest.mock('../Container', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../WebSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="web-search" />,
}));

jest.mock('../ToolCall', () => ({
  __esModule: true,
  default: () => <div data-testid="tool-call" />,
}));

jest.mock('../Image', () => ({
  __esModule: true,
  default: () => <div data-testid="image" />,
}));

jest.mock('~/utils', () => ({
  getCachedPreview: jest.fn(),
  mapAttachments: jest.fn(() => ({})),
}));

jest.mock('../parser/MessageContentParser', () => {
  const { ContentTypes, ToolCallTypes, Constants, Tools, imageGenTools, isImageVisionTool } =
    jest.requireActual('librechat-data-provider');
  const { isBashProgrammaticToolCall } = jest.requireActual('../routing');

  const resolveToolKind = (toolName: string, toolCall: Record<string, unknown>): string => {
    if (isBashProgrammaticToolCall(toolName, (toolCall as { args?: unknown }).args)) {
      return 'bash_programmatic';
    }
    if (
      toolName === String(Tools.execute_code) ||
      toolName === String(Constants.PROGRAMMATIC_TOOL_CALLING) ||
      toolName === String(Constants.BASH_PROGRAMMATIC_TOOL_CALLING)
    ) {
      return 'execute_code';
    }
    if (['image_gen_oai', 'image_edit_oai', 'gemini_image_gen'].includes(toolName)) return 'image_gen';
    if (toolName === 'skill') return 'skill';
    if (toolName === String(Constants.SUBAGENT)) return 'subagent';
    if (toolName === 'read_file') return 'read_file';
    if (['create_file', 'edit_file'].includes(toolName)) return 'file_authoring';
    if (toolName === String(Tools.bash_tool)) return 'bash_tool';
    if (toolName === String(Tools.web_search)) return 'web_search';
    if (['file_search', 'retrieval'].includes(toolName)) return 'retrieval';
    if (String(toolName).startsWith(String(Constants.LC_TRANSFER_TO_))) return 'agent_handoff';
    const callType = String(toolCall.type ?? '');
    if (callType === ToolCallTypes.CODE_INTERPRETER) return 'code_interpreter';
    if (callType === ToolCallTypes.RETRIEVAL || callType === ToolCallTypes.FILE_SEARCH) return 'retrieval';
    if (callType === ToolCallTypes.FUNCTION && 'function' in toolCall) return 'function_call';
    return 'generic_tool';
  };

  const partToRenderable = (
    part: TMessageContentParts,
    index: number,
    context: { messageId?: string; isSubmitting?: boolean; isLast?: boolean; isLastPart?: boolean },
  ) => {
    if (!part) return null;
    if (part.type === ContentTypes.TOOL_CALL) {
      const toolCall = (part as Record<string, unknown>)[ContentTypes.TOOL_CALL] as Record<string, unknown> | undefined;
      if (!toolCall) return null;
      const toolName = String(toolCall.name ?? '');
      const toolKind = resolveToolKind(toolName, toolCall);
      return {
        kind: 'tool_call',
        source: 'content_part',
        renderKey: `part-${index}`,
        index,
        metadata: {},
        toolKind,
        toolName,
        toolCallId: toolCall.id as string | undefined,
        initialProgress: typeof toolCall.progress === 'number' ? toolCall.progress : 0.1,
        args: toolCall.args as string | Record<string, unknown> | undefined,
        output: typeof toolCall.output === 'string' ? toolCall.output : undefined,
        toolCall,
        isSubmitting: context.isSubmitting,
        isLast: context.isLast,
      };
    }
    if (part.type === ContentTypes.TEXT) {
      const text = typeof (part as Record<string, unknown>).text === 'string'
        ? (part as Record<string, unknown>).text as string
        : '';
      return { kind: 'text', source: 'content_part', renderKey: `part-${index}`, index, metadata: {}, text, showCursor: context.isLastPart };
    }
    if (part.type === ContentTypes.ERROR) {
      return { kind: 'error', source: 'content_part', renderKey: `part-${index}`, index, metadata: {}, text: '' };
    }
    if (part.type === ContentTypes.THINK) {
      return { kind: 'think', source: 'content_part', renderKey: `part-${index}`, index, metadata: {}, reasoning: '' };
    }
    if (part.type === ContentTypes.IMAGE_FILE) {
      return { kind: 'image', source: 'content_part', renderKey: `part-${index}`, index, metadata: {}, imagePath: '', altText: '' };
    }
    return null;
  };

  return { partToRenderable, __esModule: true };
});

jest.mock('../renderer/RenderStandard', () => {
  const React = jest.requireActual('react');
  const { ContentTypes } = jest.requireActual('librechat-data-provider');

  const ToolCallRendererComponent = ({ item, onToolExpand }: { item: Record<string, unknown>; onToolExpand?: () => void }) => {
    const toolKind = item.toolKind as string;
    const toolCall = item.toolCall as Record<string, unknown>;
    const args = item.args;

    if (toolKind === 'bash_programmatic') {
      return <div data-testid="bash-call" data-command-field="code" />;
    }
    if (toolKind === 'execute_code') {
      if (typeof args === 'string') {
        try {
          const parsed = JSON.parse(args);
          if (!parsed.lang || parsed.lang === 'bash') {
            return <div data-testid="bash-call" data-command-field="code" />;
          }
        } catch {}
      }
      return <div data-testid="execute-code" />;
    }
    if (toolKind === 'file_authoring') {
      return <div data-testid="file-authoring-call" data-tool-name={item.toolName as string} />;
    }
    if (toolKind === 'web_search') {
      return <div data-testid="web-search" />;
    }
    if (toolKind === 'retrieval') {
      return <div data-testid="retrieval-call" />;
    }
    if (toolKind === 'agent_handoff') {
      return <div data-testid="agent-handoff" />;
    }
    if (toolKind === 'code_interpreter') {
      return <div data-testid="code-analyze" />;
    }
    if (toolKind === 'image_gen') {
      return <div data-testid="image-gen" />;
    }
    if (toolKind === 'skill') {
      return <div data-testid="skill-call" />;
    }
    if (toolKind === 'subagent') {
      return <div data-testid="subagent-call" />;
    }
    if (toolKind === 'read_file') {
      return <div data-testid="read-file-call" />;
    }
    return <div data-testid="tool-call" />;
  };

  const RenderStandardItem = ({ item, ...props }: { item: Record<string, unknown>; [key: string]: unknown }) => {
    if (item.kind === 'tool_call') {
      return <ToolCallRendererComponent item={item} onToolExpand={props.onToolExpand as (() => void) | undefined} />;
    }
    if (item.kind === 'text') {
      return <div data-testid="text">{item.text as string}</div>;
    }
    if (item.kind === 'error') {
      return <div data-testid="error-message" />;
    }
    if (item.kind === 'think') {
      return <div data-testid="reasoning" />;
    }
    if (item.kind === 'image') {
      return <div data-testid="image" />;
    }
    if (item.kind === 'empty_cursor') {
      return <div data-testid="empty-text" />;
    }
    if (item.kind === 'agent_update') {
      return <div data-testid="agent-update" />;
    }
    return null;
  };

  return { RenderStandardItem, __esModule: true };
});

const renderPart = (part: TMessageContentParts) =>
  render(<Part part={part} isSubmitting={false} showCursor={false} isCreatedByUser={false} />);

const toolCallPart = (name: string, args = '{"code":"echo hi"}'): TMessageContentParts =>
  ({
    type: ContentTypes.TOOL_CALL,
    [ContentTypes.TOOL_CALL]: {
      id: 'call_1',
      name,
      args,
      output: 'hi',
      progress: 1,
    },
  }) as unknown as TMessageContentParts;

describe('Part tool renderer selection', () => {
  it('routes bash PTC tool calls through the BashCall renderer', () => {
    renderPart(toolCallPart(Constants.BASH_PROGRAMMATIC_TOOL_CALLING));

    expect(screen.getByTestId('bash-call')).toHaveAttribute('data-command-field', 'code');
    expect(screen.queryByTestId('execute-code')).not.toBeInTheDocument();
  });

  it('routes default run_tools_with_code PTC calls through the BashCall renderer', () => {
    renderPart(toolCallPart(Constants.PROGRAMMATIC_TOOL_CALLING));

    expect(screen.getByTestId('bash-call')).toHaveAttribute('data-command-field', 'code');
    expect(screen.queryByTestId('execute-code')).not.toBeInTheDocument();
  });

  it('keeps Python PTC calls on the ExecuteCode renderer', () => {
    renderPart(
      toolCallPart(Constants.PROGRAMMATIC_TOOL_CALLING, '{"lang":"py","code":"print(1)"}'),
    );

    expect(screen.getByTestId('execute-code')).toBeInTheDocument();
    expect(screen.queryByTestId('bash-call')).not.toBeInTheDocument();
  });

  it('routes create_file calls through the file-authoring renderer', () => {
    renderPart(
      toolCallPart('create_file', '{"file_path":"skills/demo/SKILL.md","content":"# Demo"}'),
    );

    expect(screen.getByTestId('file-authoring-call')).toHaveAttribute(
      'data-tool-name',
      'create_file',
    );
    expect(screen.queryByTestId('tool-call')).not.toBeInTheDocument();
  });

  it('routes edit_file calls through the file-authoring renderer', () => {
    renderPart(
      toolCallPart(
        'edit_file',
        '{"file_path":"skills/demo/SKILL.md","old_text":"Demo","new_text":"Updated"}',
      ),
    );

    expect(screen.getByTestId('file-authoring-call')).toHaveAttribute(
      'data-tool-name',
      'edit_file',
    );
    expect(screen.queryByTestId('tool-call')).not.toBeInTheDocument();
  });
});
