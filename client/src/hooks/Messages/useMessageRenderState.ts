import { useMemo } from 'react';
import {
  ContentTypes,
  ToolCallTypes,
  Tools,
  Constants,
  isImageVisionTool,
} from 'librechat-data-provider';
import type {
  TMessage,
  TMessageContentParts,
  TAttachment,
} from 'librechat-data-provider';
import {
  MessageRenderStatus,
  BlockStatus,
  AttachmentCategory,
  AttachmentStatus,
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
  type AttachmentSummary,
  type ErrorState,
  type MessageRenderState,
  type AdaptMessageInput,
  type ToolCallGroupSummary,
} from '~/common';
import {
  artifactTypeForAttachment,
  isImageAttachment,
  isInternalSandboxArtifact,
  isTextAttachment,
  renderAttachmentKey,
  displayFilename,
} from '~/components/Chat/Messages/Content/Parts/attachmentTypes';
import { TOOL_ARTIFACT_TYPES } from '~/utils/artifacts';
import { getCachedPreview } from '~/utils/previewCache';
import { groupSequentialToolCalls } from '~/utils/groupToolCalls';
import type { PartWithIndex } from '~/components/Chat/Messages/Content/ParallelContent';
import type { ToolArtifactType } from '~/utils/artifacts';
import { isBashProgrammaticToolCall } from '~/components/Chat/Messages/Content/routing';

const ERROR_CONNECTION_TEXT = 'Error connecting to server, try refreshing the page.';

function determineMessageStatus(input: AdaptMessageInput): MessageRenderStatus {
  const { message, edit, isSubmitting, isLatestMessage } = input;
  const effectiveSubmitting = isLatestMessage && isSubmitting;

  if (edit) {
    return MessageRenderStatus.EDITING;
  }
  if (message.error) {
    return MessageRenderStatus.ERROR;
  }
  if (message.unfinished && !effectiveSubmitting) {
    return MessageRenderStatus.UNFINISHED;
  }
  if (effectiveSubmitting) {
    const content = message.content;
    const hasText =
      typeof message.text === 'string' && message.text.length > 0;
    const hasContentParts =
      Array.isArray(content) && content.length > 0;
    if (!hasText && !hasContentParts) {
      return MessageRenderStatus.EMPTY;
    }
    return MessageRenderStatus.LOADING;
  }
  return MessageRenderStatus.IDLE;
}

function extractErrorState(message: TMessage): ErrorState | undefined {
  if (!message.error) {
    return undefined;
  }
  const text = message.text || '';
  const isConnection = text === ERROR_CONNECTION_TEXT;
  return {
    type: isConnection ? ErrorType.CONNECTION : ErrorType.MESSAGE,
    message: text,
    retryable: true,
  };
}

function classifyAttachment(
  attachment: TAttachment,
  index: number,
): AttachmentSummary {
  const file = attachment as {
    file_id?: string;
    user?: string;
    source?: string;
    status?: string;
    text?: string;
    filepath?: string;
    filename?: string;
    metadata?: unknown;
    previewError?: string;
  };
  const filename = attachment.filename ?? '';
  const isWebSearch = attachment.type === Tools.web_search;
  const isInternal = isInternalSandboxArtifact(attachment);
  const isImage = isImageAttachment(attachment);
  const isText = isTextAttachment(attachment);
  const status: AttachmentStatus =
    file.status === 'failed'
      ? AttachmentStatus.FAILED
      : file.status === 'pending'
        ? AttachmentStatus.LOADING
        : AttachmentStatus.READY;

  let category: AttachmentCategory = AttachmentCategory.FILE;
  let artifactType: ToolArtifactType | undefined;

  if (isImage) {
    category = AttachmentCategory.IMAGE;
  } else if (status === AttachmentStatus.LOADING) {
    category = AttachmentCategory.PENDING;
  } else {
    const rawArtifactType = artifactTypeForAttachment(attachment);
    artifactType = rawArtifactType ?? undefined;
    if (artifactType === TOOL_ARTIFACT_TYPES.MERMAID) {
      category = AttachmentCategory.MERMAID;
    } else if (artifactType != null) {
      category = AttachmentCategory.ARTIFACT;
    } else if (isText) {
      category = AttachmentCategory.TEXT_PREVIEW;
    }
  }

  let sortKey = 0;
  if (category === AttachmentCategory.IMAGE) sortKey = 4;
  else if (category === AttachmentCategory.MERMAID) sortKey = 2;
  else if (category === AttachmentCategory.ARTIFACT) sortKey = 1;
  else if (category === AttachmentCategory.TEXT_PREVIEW) sortKey = 3;
  else if (category === AttachmentCategory.PENDING) sortKey = 99;

  return {
    id: renderAttachmentKey(category as unknown as string, attachment, index),
    category,
    status,
    attachment,
    filename,
    displayName: displayFilename(filename),
    filepath: file.filepath,
    fileId: file.file_id,
    previewError: file.previewError,
    artifactType,
    isImage,
    isText,
    isDownloadable: Boolean(file.filepath),
    isInternal,
    isWebSearch,
    sortKey,
  };
}

function getToolCallId(part: TMessageContentParts): string {
  const tcMap = part as unknown as Record<string, unknown>;
  const tc = tcMap[ContentTypes.TOOL_CALL] as
    | { id?: string }
    | undefined;
  return tc?.id ?? '';
}

function buildBlocks(
  message: TMessage,
  isSubmitting: boolean,
  isLatestMessage: boolean,
  attachmentsMap: Map<string, TAttachment[]>,
): ContentBlock[] {
  const content = message.content;
  const blocks: ContentBlock[] = [];
  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
  const safeContent: TMessageContentParts[] = Array.isArray(content)
    ? (content.filter(Boolean) as TMessageContentParts[])
    : [];
  const lastIdx = Math.max(0, safeContent.length - 1);

  const thinkingFromText = (() => {
    if (safeContent.length > 0) {
      return null;
    }
    const text = typeof message.text === 'string' ? message.text : '';
    const match = text.match(/:::thinking([\s\S]*?):::/);
    if (!match) {
      return null;
    }
    const thinking = match[1].trim();
    const regular = text.replace(/:::thinking[\s\S]*?:::/, '').trim();
    return { thinking, regular };
  })();

  if (thinkingFromText) {
    blocks.push({
      id: `thinking-${message.messageId}-legacy`,
      type: 'thinking',
      status: BlockStatus.COMPLETED,
      isLast: thinkingFromText.regular.length === 0 && safeContent.length === 0,
      showCursor: false,
      partIndex: -1,
      reasoning: thinkingFromText.thinking,
    } as ThinkingBlock);
    if (thinkingFromText.regular.length > 0) {
      blocks.push({
        id: `text-${message.messageId}-legacy`,
        type: 'text',
        status: effectiveIsSubmitting ? BlockStatus.LOADING : BlockStatus.COMPLETED,
        isLast: true,
        showCursor: isLatestMessage && isSubmitting,
        partIndex: 0,
        text: thinkingFromText.regular,
      } as TextBlock);
    }
    return blocks;
  }

  safeContent.forEach((part, idx) => {
    if (!part) return;
    const isLastPart = idx === lastIdx;
    const nextType = safeContent[idx + 1]?.type;
    const showCursor = isLastPart && isLatestMessage && isSubmitting;

    if (part.type === ContentTypes.TEXT) {
      const textPart = part as unknown as Record<string, unknown>;
      const textVal = textPart.text;
      const text =
        typeof textVal === 'string'
          ? textVal
          : typeof (textVal as { value?: string })?.value === 'string'
            ? (textVal as { value: string }).value
            : '';
      if (typeof text !== 'string') return;
      const toolCallIds = textPart.tool_call_ids as string[] | undefined;
      if (toolCallIds != null && !text) return;
      if (text.length > 0 && /^\s*$/.test(text)) {
        if (isLastPart && showCursor) {
          blocks.push({
            id: `text-${message.messageId}-${idx}`,
            type: 'text',
            status: BlockStatus.LOADING,
            isLast: isLastPart,
            showCursor,
            nextType,
            partIndex: idx,
            text: '',
          } as TextBlock);
          return;
        }
        if (!isLastPart) return;
      }
      blocks.push({
        id: `text-${message.messageId}-${idx}`,
        type: 'text',
        status: effectiveIsSubmitting && !text ? BlockStatus.LOADING : BlockStatus.COMPLETED,
        isLast: isLastPart,
        showCursor,
        nextType,
        partIndex: idx,
        text,
        toolCallIds,
      } as TextBlock);
    } else if (part.type === ContentTypes.THINK) {
      const thinkPart = part as unknown as Record<string, unknown>;
      const thinkVal = thinkPart.think;
      const reasoning =
        typeof thinkVal === 'string'
          ? thinkVal
          : typeof (thinkVal as { value?: string })?.value === 'string'
            ? (thinkVal as { value: string }).value
            : '';
      if (typeof reasoning !== 'string') return;
      blocks.push({
        id: `thinking-${message.messageId}-${idx}`,
        type: 'thinking',
        status: BlockStatus.COMPLETED,
        isLast: isLastPart,
        showCursor: false,
        nextType,
        partIndex: idx,
        reasoning,
      } as ThinkingBlock);
    } else if (part.type === ContentTypes.ERROR) {
      const errPart = part as unknown as Record<string, unknown>;
      const errVal = errPart[ContentTypes.ERROR];
      const textVal = errPart[ContentTypes.TEXT];
      const errMsg =
        (typeof errVal === 'string' ? errVal : '') ||
        (typeof textVal === 'string'
          ? textVal
          : typeof (textVal as { value?: string })?.value === 'string'
            ? (textVal as { value: string }).value
            : '') ||
        '';
      blocks.push({
        id: `error-${message.messageId}-${idx}`,
        type: 'error',
        status: BlockStatus.ERROR,
        isLast: isLastPart,
        showCursor,
        nextType,
        partIndex: idx,
        message: typeof errMsg === 'string' ? errMsg : String(errMsg),
        errorType: ErrorType.MESSAGE,
        retryable: true,
      } as ErrorBlock);
    } else if (part.type === ContentTypes.AGENT_UPDATE) {
      const update = part as unknown as Record<string, unknown>;
      blocks.push({
        id: `agent-update-${message.messageId}-${idx}`,
        type: 'agent_update',
        status: BlockStatus.COMPLETED,
        isLast: isLastPart,
        showCursor,
        nextType,
        partIndex: idx,
        agentId: (update[ContentTypes.AGENT_UPDATE] as { agentId?: string })?.agentId,
      } as AgentUpdateBlock);
    } else if (part.type === ContentTypes.SUMMARY) {
      const sumPart = part as unknown as Record<string, unknown>;
      blocks.push({
        id: `summary-${message.messageId}-${idx}`,
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
      } as SummaryBlock);
    } else if (part.type === ContentTypes.IMAGE_FILE) {
      const imgPart = part as unknown as Record<string, unknown>;
      const imgFile = imgPart[ContentTypes.IMAGE_FILE] as Record<string, unknown>;
      blocks.push({
        id: `image-${message.messageId}-${idx}`,
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
        cachedPreview: typeof imgFile.file_id === 'string'
          ? getCachedPreview(imgFile.file_id)
          : undefined,
      } as ImageBlock);
    } else if (part.type === ContentTypes.TOOL_CALL) {
      const tcPart = part as unknown as Record<string, unknown>;
      const toolCall = tcPart[ContentTypes.TOOL_CALL] as
        | Record<string, unknown>
        | undefined;
      if (!toolCall) return;

      const toolCallId = (toolCall.id as string) ?? '';
      const toolName = (toolCall.name as string) || '';
      const rawOutput = (toolCall.output as string) ?? '';
      const progress = (toolCall.progress as number) ?? 0.1;
      const rawArgs = toolCall.args ?? '';
      const hasOutput = Boolean(rawOutput && rawOutput.length > 0);
      const runStatus: ToolRunStatus = effectiveIsSubmitting && !hasOutput
        ? ToolRunStatus.RUNNING
        : hasOutput
          ? ToolRunStatus.COMPLETED
          : ToolRunStatus.COMPLETED;

      const partAttachments = toolCallId
        ? attachmentsMap.get(toolCallId)
        : undefined;

      const persistedContent = (
        toolCall as { subagent_content?: TMessageContentParts[] }
      ).subagent_content;

      const isToolCallShape =
        'args' in toolCall &&
        (!toolCall.type || (toolCall.type as string) === ToolCallTypes.TOOL_CALL);

      const isProgrammaticBash =
        isToolCallShape &&
        isBashProgrammaticToolCall(
          toolName,
          typeof rawArgs === 'string' || typeof rawArgs === 'object' && rawArgs !== null
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
        isToolCallShape &&
        (toolName === 'create_file' || toolName === 'edit_file');

      const isBashTool = isToolCallShape && toolName === Tools.bash_tool;

      const isWebSearch = isToolCallShape && toolName === Tools.web_search;

      const isRetrieval =
        isToolCallShape &&
        (toolName === 'file_search' || toolName === 'retrieval');

      const isAgentHandoff =
        isToolCallShape &&
        Boolean(typeof toolName?.startsWith?.(Constants.LC_TRANSFER_TO_));

      const isCodeInterpreter =
        (toolCall.type as string) === ToolCallTypes.CODE_INTERPRETER;

      const isRetrievalType =
        (toolCall.type as string) === ToolCallTypes.RETRIEVAL ||
        (toolCall.type as string) === ToolCallTypes.FILE_SEARCH;

      const isFunctionType = (toolCall.type as string) === ToolCallTypes.FUNCTION;

      let finalArgs: unknown = typeof rawArgs === 'string' ? rawArgs : rawArgs;
      let finalOutput = rawOutput;

      if (isCodeInterpreter) {
        finalArgs = (toolCall[ToolCallTypes.CODE_INTERPRETER] as { input?: string })?.input ?? '';
        finalOutput = JSON.stringify(
          (toolCall[ToolCallTypes.CODE_INTERPRETER] as { outputs?: unknown[] })?.outputs ?? [],
        );
      } else if (isFunctionType && ToolCallTypes.FUNCTION in toolCall) {
        const fn = toolCall as unknown as Record<string, unknown>;
        const fnObj = fn[ToolCallTypes.FUNCTION] as { arguments?: string; output?: string };
        finalArgs = fnObj.arguments ?? '';
        finalOutput = fnObj.output ?? '';
      }

      const isImageVision = isFunctionType && isImageVisionTool(part as any);

      if (isImageVision && effectiveIsSubmitting && showCursor) {
        blocks.push({
          id: `text-${message.messageId}-${idx}`,
          type: 'text',
          status: BlockStatus.LOADING,
          isLast: isLastPart,
          showCursor,
          nextType,
          partIndex: idx,
          text: '',
        } as TextBlock);
        return;
      }

      blocks.push({
        id: `tool-call-${message.messageId}-${idx}`,
        type: 'tool_call',
        status: effectiveIsSubmitting
          ? BlockStatus.LOADING
          : BlockStatus.COMPLETED,
        isLast: isLastPart,
        showCursor,
        nextType,
        partIndex: idx,
        toolCallId,
        toolName,
        args: finalArgs,
        output: finalOutput,
        progress,
        runStatus,
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
      } as ToolCallBlock);
    }
  });

  return blocks;
}

function buildAttachmentsMap(
  attachments: TAttachment[] | undefined,
): Map<string, TAttachment[]> {
  const map = new Map<string, TAttachment[]>();
  if (!attachments) return map;
  for (const att of attachments) {
    const toolCallId = (att as Record<string, unknown>).tool_call_id as string | undefined;
    if (toolCallId) {
      const list = map.get(toolCallId) ?? [];
      list.push(att);
      map.set(toolCallId, list);
    }
  }
  return map;
}

type GroupedPart =
  | { type: 'single'; part: PartWithIndex }
  | { type: 'tool-group'; parts: PartWithIndex[] };

function buildToolCallGroups(
  sequentialParts: PartWithIndex[],
  attachmentsMap: Map<string, TAttachment[]>,
  isSubmitting: boolean,
  isLatestMessage: boolean,
  lastContentIdx: number,
  messageId: string,
): ToolCallGroupSummary[] {
  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
  const grouped = groupSequentialToolCalls(sequentialParts) as unknown as GroupedPart[];
  let fallbackScope = 0;
  const fallbackScopeRef = { messageId, scope: 0 };
  if (fallbackScopeRef.messageId !== messageId) {
    if (!effectiveIsSubmitting) {
      fallbackScopeRef.scope += 1;
    }
    fallbackScopeRef.messageId = messageId;
  }
  fallbackScope = fallbackScopeRef.scope;

  return grouped
    .filter((g): g is { type: 'tool-group'; parts: PartWithIndex[] } => g.type === 'tool-group')
    .map((group) => {
      const firstPart = group.parts[0];
      let groupId = 'empty';
      if (firstPart) {
        const tcId = getToolCallId(firstPart.part);
        groupId = tcId
          ? `tool:${tcId}`
          : `fallback:${fallbackScope++}:${firstPart.idx}`;
      }
      const groupAttachments = group.parts.flatMap(({ part }) => {
        const id = getToolCallId(part);
        return id ? attachmentsMap.get(id) ?? [] : [];
      });
      return {
        groupId,
        parts: group.parts,
        groupAttachments,
        isSubmitting: effectiveIsSubmitting,
        isLast: group.parts.some((p) => p.idx === lastContentIdx),
      } as ToolCallGroupSummary;
    });
}

function getChatWidthClass(
  maximizeChatSpace: boolean,
  hasParallel: boolean,
): string {
  if (maximizeChatSpace) {
    return 'w-full max-w-full md:px-5 lg:px-1 xl:px-5';
  }
  if (hasParallel) {
    return 'md:max-w-[58rem] xl:max-w-[70rem]';
  }
  return 'md:max-w-[47rem] xl:max-w-[55rem';
}

export default function useMessageRenderState(
  input: AdaptMessageInput,
): MessageRenderState {
  return useMemo<MessageRenderState>(() => {
    const {
      message,
      edit,
      isSubmitting,
      isLatestMessage,
      latestMessageDepth,
      attachments,
      maximizeChatSpace = false,
      chatContext,
      agent,
      assistant,
      feedback,
      label,
      iconData,
      actions,
      siblingIdx,
      siblingCount,
      setSiblingIdx,
      currentEditId,
      setCurrentEditId,
      searchResults,
    } = input;

    const childrenLen = message.children?.length ?? 0;
    const hasNoChildren = childrenLen === 0;
    const isLastInTree =
      hasNoChildren &&
      (message.depth === latestMessageDepth || message.depth === -1);

    const status = determineMessageStatus({ ...input, edit });
    const error = extractErrorState(message);

    const attachmentsArray = attachments ?? [];
    const classifiedAttachments: AttachmentSummary[] = attachmentsArray.map(
      (att, i) => classifyAttachment(att, i),
    );

    const visibleAttachments = classifiedAttachments.filter(
      (a) => !a.isWebSearch && !a.isInternal,
    );

    const attachmentsMap = buildAttachmentsMap(attachmentsArray);
    const blocks = buildBlocks(
      message,
      isSubmitting,
      isLatestMessage,
      attachmentsMap,
    );

    const content = message.content;
    const safeContent = Array.isArray(content)
      ? (content.filter(Boolean) as TMessageContentParts[])
      : [];
    const sequentialParts: PartWithIndex[] = safeContent.map((part, idx) => ({
      part,
      idx,
    }));
    const lastContentIdx = Math.max(0, safeContent.length - 1);

    const hasParallelContent = safeContent.some(
      (part) => {
        const p = part as unknown as { groupId?: unknown };
        return p?.groupId != null;
      },
    );
    const parallelGroups = hasParallelContent
      ? Array.from(
          new Set(
            safeContent
              .map((p) => (p as unknown as { groupId?: string }).groupId)
              .filter((g): g is string => Boolean(g)),
          ),
        )
      : undefined;

    const toolCallGroups = buildToolCallGroups(
      sequentialParts,
      attachmentsMap,
      isSubmitting,
      isLatestMessage,
      lastContentIdx,
      message.messageId ?? '',
    );

    const pendingSkills =
      !message.isCreatedByUser && message.manualSkills != null
        ? message.manualSkills
        : [];
    const hasPendingSkills = pendingSkills.length > 0;

    const hasRealContent = safeContent.some((part) => {
      if (part == null) return false;
      if (part.type !== ContentTypes.TEXT) return true;
      const tp = part as unknown as Record<string, unknown>;
      const textVal = tp.text;
      const text =
        typeof textVal === 'string'
          ? textVal
          : typeof (textVal as { value?: string })?.value === 'string'
            ? (textVal as { value: string }).value
            : '';
      return text.length > 0;
    });

    const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
    const showEmptyCursor =
      safeContent.length === 0 && effectiveIsSubmitting;
    const showThinkingCursor =
      safeContent.length > 0 &&
      effectiveIsSubmitting &&
      safeContent[safeContent.length - 1]?.type === ContentTypes.THINK;

    return {
      messageId: message.messageId ?? '',
      isCreatedByUser: message.isCreatedByUser ?? true,
      isLatestMessage,
      isLastInTree,
      label,
      iconData,
      conversationId: chatContext.conversation?.conversationId,
      endpoint: message.endpoint ?? chatContext.conversation?.endpoint,
      model: message.model ?? chatContext.conversation?.model,
      status,
      error,
      isSubmitting: effectiveIsSubmitting,
      edit: actions.edit,
      blocks,
      attachments: visibleAttachments,
      searchResults: searchResults as Record<string, unknown> | undefined,
      pendingSkills,
      hasRealContent,
      hasPendingSkills,
      hasParallelContent,
      chatWidthClass: getChatWidthClass(maximizeChatSpace, hasParallelContent),
      parallelGroups,
      toolCallGroups,
      showEmptyCursor,
      showThinkingCursor,
      actions,
      siblingIdx,
      siblingCount,
      setSiblingIdx,
      currentEditId,
      setCurrentEditId,
      agent,
      assistant,
      feedback,
      chatContext,
    } as MessageRenderState;
  }, [input]);
}
