import {
  ContentTypes,
  ToolCallTypes,
  Tools,
  Constants,
  isImageVisionTool,
} from 'librechat-data-provider';
import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import {
  BlockStatus,
  ToolRunStatus,
  ErrorType,
  type ContentBlock,
  type TextBlock,
  type ThinkingBlock,
  type ToolCallBlock,
  type ImageBlock,
  type ErrorBlock,
  type AgentUpdateBlock,
  type SummaryBlock,
} from '~/common';
import { getCachedPreview } from '~/utils/previewCache';
import { isBashProgrammaticToolCall } from '~/components/Chat/Messages/Content/routing';

export type BlockBuildContext = {
  messageId: string;
  isSubmitting: boolean;
  isLatestMessage: boolean;
  lastIdx: number;
  attachmentsMap: Map<string, TAttachment[]>;
};

export function buildContentBlock(
  part: TMessageContentParts,
  idx: number,
  ctx: BlockBuildContext,
): ContentBlock | null {
  const { messageId, isSubmitting, isLatestMessage, lastIdx, attachmentsMap } = ctx;
  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
  const isLastPart = idx === lastIdx;
  const nextType: string | undefined = undefined;
  const showCursor = false;

  if (part.type === ContentTypes.TEXT) {
    const textPart = part as unknown as Record<string, unknown>;
    const textVal = textPart.text;
    const text =
      typeof textVal === 'string'
        ? textVal
        : typeof (textVal as { value?: string })?.value === 'string'
          ? (textVal as { value: string }).value
          : '';
    if (typeof text !== 'string') return null;
    const toolCallIds = textPart.tool_call_ids as string[] | undefined;
    if (toolCallIds != null && !text) return null;
    if (text.length > 0 && /^\s*$/.test(text)) {
      return null;
    }
    return {
      id: `text-${messageId}-${idx}`,
      type: 'text',
      status: effectiveIsSubmitting && !text ? BlockStatus.LOADING : BlockStatus.COMPLETED,
      isLast: isLastPart,
      showCursor,
      nextType,
      partIndex: idx,
      text,
      toolCallIds,
    } as TextBlock;
  }

  if (part.type === ContentTypes.THINK) {
    const thinkPart = part as unknown as Record<string, unknown>;
    const thinkVal = thinkPart.think;
    const reasoning =
      typeof thinkVal === 'string'
        ? thinkVal
        : typeof (thinkVal as { value?: string })?.value === 'string'
          ? (thinkVal as { value: string }).value
          : '';
    if (typeof reasoning !== 'string') return null;
    return {
      id: `thinking-${messageId}-${idx}`,
      type: 'thinking',
      status: BlockStatus.COMPLETED,
      isLast: isLastPart,
      showCursor,
      nextType,
      partIndex: idx,
      reasoning,
    } as ThinkingBlock;
  }

  if (part.type === ContentTypes.ERROR) {
    const errPart = part as unknown as Record<string, unknown>;
    const errVal = errPart[ContentTypes.ERROR];
    const textVal = errPart[ContentTypes.TEXT];
    const errMsg =
      (typeof errVal === 'string' ? errVal : '') ||
      (typeof textVal === 'string'
        ? textVal
        : typeof (textVal as { value?: string })?.value === 'string'
          ? (textVal as { value: string }).value
          : '') || '';
    return {
      id: `error-${messageId}-${idx}`,
      type: 'error',
      status: BlockStatus.ERROR,
      isLast: isLastPart,
      showCursor,
      nextType,
      partIndex: idx,
      message: typeof errMsg === 'string' ? errMsg : String(errMsg),
      errorType: ErrorType.MESSAGE,
      retryable: true,
    } as ErrorBlock;
  }

  if (part.type === ContentTypes.AGENT_UPDATE) {
    const update = part as unknown as Record<string, unknown>;
    return {
      id: `agent-update-${messageId}-${idx}`,
      type: 'agent_update',
      status: BlockStatus.COMPLETED,
      isLast: isLastPart,
      showCursor,
      nextType,
      partIndex: idx,
      agentId: (update[ContentTypes.AGENT_UPDATE] as { agentId?: string })?.agentId,
    } as AgentUpdateBlock;
  }

  if (part.type === ContentTypes.SUMMARY) {
    const sumPart = part as unknown as Record<string, unknown>;
    return {
      id: `summary-${messageId}-${idx}`,
      type: 'summary',
      status: sumPart.summarizing ? BlockStatus.LOADING : BlockStatus.COMPLETED,
      isLast: isLastPart,
      showCursor,
      nextType,
      partIndex: idx,
      content: sumPart.content as string | undefined,
      model: sumPart.model as string | undefined,
      provider: sumPart.provider as string | undefined,
      tokenCount: sumPart.tokenCount as number | undefined,
      summarizing: sumPart.summarizing as boolean | undefined,
    } as SummaryBlock;
  }

  if (part.type === ContentTypes.IMAGE_FILE) {
    const imgPart = part as unknown as Record<string, unknown>;
    const imgFile = imgPart[ContentTypes.IMAGE_FILE] as Record<string, unknown>;
    return {
      id: `image-${messageId}-${idx}`,
      type: 'image',
      status: BlockStatus.COMPLETED,
      isLast: isLastPart,
      showCursor,
      nextType,
      partIndex: idx,
      filepath: imgFile.filepath as string | undefined,
      fileId: imgFile.file_id as string | undefined,
      filename: imgFile.filename as string | undefined,
      width: imgFile.width as number | undefined,
      height: imgFile.height as number | undefined,
      cachedPreview:
        typeof imgFile.file_id === 'string'
          ? getCachedPreview(imgFile.file_id)
          : undefined,
    } as ImageBlock;
  }

  if (part.type === ContentTypes.TOOL_CALL) {
    const isImageVisionPlaceholder =
      isImageVisionTool(part as any) && effectiveIsSubmitting;
    if (isImageVisionPlaceholder) {
      return {
        id: `text-${messageId}-${idx}`,
        type: 'text',
        status: BlockStatus.LOADING,
        isLast: isLastPart,
        showCursor,
        nextType,
        partIndex: idx,
        text: '',
      } as TextBlock;
    }
    return buildToolCallBlock(part, idx, ctx);
  }

  return null;
}

function buildToolCallBlock(
  part: TMessageContentParts,
  idx: number,
  ctx: BlockBuildContext,
): ToolCallBlock | null {
  const { messageId, isSubmitting, isLatestMessage, attachmentsMap } = ctx;
  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
  const isLastPart = idx === ctx.lastIdx;
  const nextType: string | undefined = undefined;
  const showCursor = false;

  const tcPart = part as unknown as Record<string, unknown>;
  const toolCall = tcPart[ContentTypes.TOOL_CALL] as
    | Record<string, unknown>
    | undefined;
  if (!toolCall) return null;

  const toolCallId = (toolCall.id as string) ?? '';
  const toolName = (toolCall.name as string) || '';
  const rawOutput = (toolCall.output as string) ?? '';
  const progress = (toolCall.progress as number) ?? 0.1;
  const rawArgs = toolCall.args ?? '';
  const hasOutput = Boolean(rawOutput && rawOutput.length > 0);

  const partAttachments = toolCallId ? attachmentsMap.get(toolCallId) : undefined;
  const persistedContent = (toolCall as { subagent_content?: TMessageContentParts[] })
    .subagent_content;

  const isToolCallShape =
    'args' in toolCall &&
    (!toolCall.type || (toolCall.type as string) === ToolCallTypes.TOOL_CALL);

  const isProgrammaticBash =
    isToolCallShape &&
    isBashProgrammaticToolCall(
      toolName,
      typeof rawArgs === 'string' || (typeof rawArgs === 'object' && rawArgs !== null)
        ? (rawArgs as string | Record<string, unknown>)
        : undefined,
    );

  const isExecuteCode =
    isToolCallShape &&
    (toolName === Tools.execute_code ||
      toolName === Constants.PROGRAMMATIC_TOOL_CALLING ||
      toolName === Constants.BASH_PROGRAMMATIC_TOOL_CALLING);

  const isImageGen =
    isToolCallShape &&
    (toolName === 'image_gen_oai' ||
      toolName === 'image_edit_oai' ||
      toolName === 'gemini_image_gen');

  const isSkill = isToolCallShape && toolName === 'skill';
  const isSubagent = isToolCallShape && toolName === Constants.SUBAGENT;
  const isReadFile = isToolCallShape && toolName === 'read_file';
  const isFileAuthoring =
    isToolCallShape && (toolName === 'create_file' || toolName === 'edit_file');
  const isBashTool = isToolCallShape && toolName === Tools.bash_tool;
  const isWebSearch = isToolCallShape && toolName === Tools.web_search;
  const isRetrieval =
    isToolCallShape && (toolName === 'file_search' || toolName === 'retrieval');
  const isAgentHandoff =
    isToolCallShape && Boolean(typeof toolName?.startsWith?.(Constants.LC_TRANSFER_TO_));
  const isCodeInterpreter = (toolCall.type as string) === ToolCallTypes.CODE_INTERPRETER;
  const isRetrievalType =
    (toolCall.type as string) === ToolCallTypes.RETRIEVAL ||
    (toolCall.type as string) === ToolCallTypes.FILE_SEARCH;
  const isFunctionType = (toolCall.type as string) === ToolCallTypes.FUNCTION;

  let finalArgs: unknown = typeof rawArgs === 'string' ? rawArgs : rawArgs;
  let finalOutput = rawOutput;

  if (isCodeInterpreter) {
    finalArgs =
      (toolCall[ToolCallTypes.CODE_INTERPRETER] as { input?: string })?.input ?? '';
    finalOutput = JSON.stringify(
      (toolCall[ToolCallTypes.CODE_INTERPRETER] as { outputs?: unknown[] })?.outputs ??
        [],
    );
  } else if (isFunctionType && ToolCallTypes.FUNCTION in toolCall) {
    const fn = toolCall as unknown as Record<string, unknown>;
    const fnObj = fn[ToolCallTypes.FUNCTION] as {
      arguments?: string;
      output?: string;
    };
    finalArgs = fnObj.arguments ?? '';
    finalOutput = fnObj.output ?? '';
  }

  return {
    id: `tool-call-${messageId}-${idx}`,
    type: 'tool_call',
    status: effectiveIsSubmitting ? BlockStatus.LOADING : BlockStatus.COMPLETED,
    isLast: isLastPart,
    showCursor,
    nextType,
    partIndex: idx,
    toolCallId,
    toolName,
    args: finalArgs,
    output: finalOutput,
    progress,
    runStatus:
      effectiveIsSubmitting && !hasOutput
        ? ToolRunStatus.RUNNING
        : ToolRunStatus.COMPLETED,
    auth: toolCall.auth,
    attachments: partAttachments,
    persistedContent,
    isProgrammaticBash,
    isBashTool,
    isExecuteCode,
    isImageGen,
    isSkill,
    isSubagent,
    isReadFile,
    isFileAuthoring,
    isWebSearch,
    isRetrieval,
    isAgentHandoff,
    isCodeInterpreter,
    isGenericTool:
      isToolCallShape &&
      !isProgrammaticBash &&
      !isExecuteCode &&
      !isImageGen &&
      !isSkill &&
      !isSubagent &&
      !isReadFile &&
      !isFileAuthoring &&
      !isBashTool &&
      !isWebSearch &&
      !isRetrieval &&
      !isAgentHandoff &&
      !isCodeInterpreter &&
      !isRetrievalType &&
      !isFunctionType,
  } as ToolCallBlock;
}

export function buildAllBlocks(
  safeContent: TMessageContentParts[],
  ctx: BlockBuildContext,
  legacyThinking: { reasoning: string; regular: string } | null,
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const { messageId, isSubmitting, isLatestMessage } = ctx;
  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;

  if (legacyThinking) {
    blocks.push({
      id: `thinking-${messageId}-legacy`,
      type: 'thinking',
      status: BlockStatus.COMPLETED,
      isLast: legacyThinking.regular.length === 0,
      showCursor: false,
      partIndex: -1,
      reasoning: legacyThinking.reasoning,
    } as ThinkingBlock);
    if (legacyThinking.regular.length > 0) {
      blocks.push({
        id: `text-${messageId}-legacy`,
        type: 'text',
        status: effectiveIsSubmitting ? BlockStatus.LOADING : BlockStatus.COMPLETED,
        isLast: true,
        showCursor: isLatestMessage && isSubmitting,
        partIndex: 0,
        text: legacyThinking.regular,
      } as TextBlock);
    }
    return blocks;
  }

  const lastIdx = Math.max(0, safeContent.length - 1);
  const ctxWithLast = { ...ctx, lastIdx };

  for (let idx = 0; idx < safeContent.length; idx++) {
    const part = safeContent[idx];
    if (!part) continue;
    const block = buildContentBlock(part, idx, ctxWithLast);
    if (block) {
      const isLastPart = idx === lastIdx;
      const showCursor = isLastPart && isLatestMessage && isSubmitting;
      const nextType = safeContent[idx + 1]?.type;
      block.isLast = isLastPart;
      block.showCursor = showCursor;
      block.nextType = nextType;
      blocks.push(block);
    }
  }

  return blocks;
}

export function parseLegacyThinking(text: string): {
  reasoning: string;
  regular: string;
} | null {
  const match = text.match(/:::thinking([\s\S]*?):::/);
  if (!match) return null;
  const thinking = match[1].trim();
  const regular = text.replace(/:::thinking[\s\S]*?:::/, '').trim();
  return { reasoning: thinking, regular };
}
