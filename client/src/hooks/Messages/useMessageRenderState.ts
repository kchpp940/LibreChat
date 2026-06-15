import { useMemo } from 'react';
import { ContentTypes, Tools } from 'librechat-data-provider';
import type { TMessage, TMessageContentParts, TAttachment } from 'librechat-data-provider';
import {
  MessageRenderStatus,
  AttachmentCategory,
  AttachmentStatus,
  ErrorType,
  type ContentBlock,
  type ToolCallBlock,
  type AttachmentSummary,
  type ErrorState,
  type MessageRenderState,
  type AdaptMessageInput,
  type ToolCallGroupSummary,
  type ParallelSectionSummary,
  type ParallelColumnSummary,
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
import { groupSequentialToolCalls } from '~/utils/groupToolCalls';
import type { PartWithIndex } from '~/components/Chat/Messages/Content/ParallelContent';
import type { ToolArtifactType } from '~/utils/artifacts';
import { buildAllBlocks, parseLegacyThinking, type BlockBuildContext } from './contentBlockBuilder';

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
    const hasText = typeof message.text === 'string' && message.text.length > 0;
    const hasContentParts = Array.isArray(content) && content.length > 0;
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

function classifyAttachment(attachment: TAttachment, index: number): AttachmentSummary {
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

function buildAttachmentsMap(attachments: TAttachment[] | undefined): Map<string, TAttachment[]> {
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

function buildToolCallGroupsFromBlocks(
  safeContent: TMessageContentParts[],
  attachmentsMap: Map<string, TAttachment[]>,
  isSubmitting: boolean,
  isLatestMessage: boolean,
  lastContentIdx: number,
  messageId: string,
  blocks: ContentBlock[],
): ToolCallGroupSummary[] {
  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
  const sequentialParts: PartWithIndex[] = safeContent.map((part, idx) => ({ part, idx }));
  const grouped = groupSequentialToolCalls(sequentialParts) as unknown as Array<
    | { type: 'single'; part: PartWithIndex }
    | { type: 'tool-group'; parts: PartWithIndex[] }
  >;
  let fallbackScope = 0;

  const blockByPartIndex = new Map<number, ToolCallBlock>();
  for (const b of blocks) {
    if (b.type === 'tool_call') {
      blockByPartIndex.set(b.partIndex, b as ToolCallBlock);
    }
  }

  return grouped
    .filter((g): g is { type: 'tool-group'; parts: PartWithIndex[] } => g.type === 'tool-group')
    .map((group) => {
      const firstPart = group.parts[0];
      let groupId = 'empty';
      if (firstPart) {
        const tcId = (firstPart.part?.[ContentTypes.TOOL_CALL] as { id?: string } | undefined)?.id ?? '';
        groupId = tcId
          ? `tool:${tcId}`
          : `fallback:${fallbackScope++}:${firstPart.idx}`;
      }
      const groupAttachments = group.parts.flatMap(({ part }) => {
        const id = (part?.[ContentTypes.TOOL_CALL] as { id?: string } | undefined)?.id ?? '';
        return id ? attachmentsMap.get(id) ?? [] : [];
      });
      const toolBlocks = group.parts
        .map(({ idx }) => blockByPartIndex.get(idx))
        .filter((b): b is ToolCallBlock => b != null);

      return {
        groupId,
        toolBlocks,
        groupAttachments,
        isSubmitting: effectiveIsSubmitting,
        isLast: group.parts.some((p) => p.idx === lastContentIdx),
      } as ToolCallGroupSummary;
    });
}

function buildParallelSectionsFromBlocks(
  safeContent: TMessageContentParts[],
  blocks: ContentBlock[],
): ParallelSectionSummary[] {
  const groupMap = new Map<number, { agentId: string; partIndices: number[] }[]>();
  const placeholderAgents = new Map<number, Set<string>>();

  safeContent.forEach((part, idx) => {
    if (!part) return;
    const p = part as unknown as { groupId?: number; agentId?: string };
    if (p.groupId == null) return;

    if (!part.type && p.agentId) {
      if (!placeholderAgents.has(p.groupId)) {
        placeholderAgents.set(p.groupId, new Set());
      }
      placeholderAgents.get(p.groupId)!.add(p.agentId);
      return;
    }

    if (!groupMap.has(p.groupId)) {
      groupMap.set(p.groupId, []);
    }
    const columns = groupMap.get(p.groupId)!;
    const agentId = p.agentId ?? 'unknown';
    let col = columns.find((c) => c.agentId === agentId);
    if (!col) {
      col = { agentId, partIndices: [] };
      columns.push(col);
    }
    col.partIndices.push(idx);
  });

  const allGroupIds = new Set([...groupMap.keys(), ...placeholderAgents.keys()]);
  const sections: ParallelSectionSummary[] = [];

  const blockByPartIndex = new Map<number, ContentBlock>();
  for (const b of blocks) {
    blockByPartIndex.set(b.partIndex, b);
  }

  for (const groupId of allGroupIds) {
    const columnsData = groupMap.get(groupId) ?? [];

    const sortedColumns = [...columnsData].sort((a, b) => {
      const aHasSuffix = a.agentId.includes('____');
      const bHasSuffix = b.agentId.includes('____');
      if (aHasSuffix && !bHasSuffix) return 1;
      if (!aHasSuffix && bHasSuffix) return -1;
      return 0;
    });

    const groupPlaceholders = placeholderAgents.get(groupId);
    if (groupPlaceholders) {
      for (const placeholderAgentId of groupPlaceholders) {
        if (!sortedColumns.find((c) => c.agentId === placeholderAgentId)) {
          sortedColumns.push({ agentId: placeholderAgentId, partIndices: [] });
        }
      }
    }

    const columns: ParallelColumnSummary[] = sortedColumns.map((col) => {
      const colBlocks = col.partIndices
        .map((idx) => blockByPartIndex.get(idx))
        .filter((b): b is ContentBlock => b != null);
      return {
        agentId: col.agentId,
        blocks: colBlocks,
        isEmpty: colBlocks.length === 0,
      };
    });

    sections.push({ groupId, columns });
  }

  return sections;
}

function getChatWidthClass(maximizeChatSpace: boolean, hasParallel: boolean): string {
  if (maximizeChatSpace) {
    return 'w-full max-w-full md:px-5 lg:px-1 xl:px-5';
  }
  if (hasParallel) {
    return 'md:max-w-[58rem] xl:max-w-[70rem]';
  }
  return 'md:max-w-[47rem] xl:max-w-[55rem]';
}

export default function useMessageRenderState(input: AdaptMessageInput): MessageRenderState {
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
      hasNoChildren && (message.depth === latestMessageDepth || message.depth === -1);

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

    const content = message.content;
    const safeContent: TMessageContentParts[] = Array.isArray(content)
      ? (content.filter(Boolean) as TMessageContentParts[])
      : [];

    const legacyThinking = safeContent.length === 0 && typeof message.text === 'string'
      ? parseLegacyThinking(message.text)
      : null;

    const ctx: BlockBuildContext = {
      messageId: message.messageId ?? '',
      isSubmitting,
      isLatestMessage,
      lastIdx: Math.max(0, safeContent.length - 1),
      attachmentsMap,
    };

    const blocks = buildAllBlocks(safeContent, ctx, legacyThinking);

    const lastContentIdx = Math.max(0, safeContent.length - 1);

    const hasParallelContent = safeContent.some((part) => {
      const p = part as unknown as { groupId?: unknown };
      return p?.groupId != null;
    });

    const parallelSections = buildParallelSectionsFromBlocks(safeContent, blocks);

    const toolCallGroups = buildToolCallGroupsFromBlocks(
      safeContent,
      attachmentsMap,
      isSubmitting,
      isLatestMessage,
      lastContentIdx,
      message.messageId ?? '',
      blocks,
    );

    const pendingSkills =
      !message.isCreatedByUser && message.manualSkills != null
        ? message.manualSkills
        : [];
    const hasPendingSkills = pendingSkills.length > 0;

    const hasRealContent = blocks.some(
      (b) => b.type === 'text' && (b as { text?: string }).text && (b as { text?: string }).text!.length > 0,
    ) || blocks.some((b) => b.type !== 'text' && b.type !== 'error');

    const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
    const showEmptyCursor = safeContent.length === 0 && effectiveIsSubmitting;
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
      parallelSections,
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
