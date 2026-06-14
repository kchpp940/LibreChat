import type {
  TMessageContentParts,
  TAttachment,
  TMessage,
  Agents,
} from 'librechat-data-provider';
import {
  ContentTypes,
  ToolCallTypes,
  Tools,
  Constants,
  imageGenTools,
  isImageVisionTool,
} from 'librechat-data-provider';
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
  RenderableItemGroup,
  ParseMessageContentOptions,
  RenderableKind,
  RenderableSource,
} from './types';
import { getCachedPreview } from '~/utils';
import {
  artifactTypeForAttachment,
  isImageAttachment,
  isInternalSandboxArtifact,
  isTextAttachment,
  renderAttachmentKey,
} from '../Parts/attachmentTypes';
import { TOOL_ARTIFACT_TYPES, type ToolArtifactType } from '~/utils/artifacts';
import { isBashProgrammaticToolCall } from '../routing';

type AnyRecord = Record<string, unknown>;
type AttachmentMap = Record<string, TAttachment[] | undefined>;

const getTextValue = (field: unknown): string | undefined => {
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && 'value' in field) {
    const v = (field as AnyRecord).value;
    if (typeof v === 'string') return v;
  }
  return undefined;
};

export interface PartToRenderableContext {
  messageId: string;
  attachments?: TAttachment[];
  attachmentMap?: AttachmentMap;
  isSubmitting?: boolean;
  isLast?: boolean;
  isLastPart?: boolean;
}

export const partToRenderable = (
  part: TMessageContentParts,
  index: number,
  context: PartToRenderableContext,
): RenderableItem | null => {
  const { messageId, isSubmitting, isLast, isLastPart } = context;
  const renderKey = `${messageId}-part-${index}`;
  const partRecord = part as unknown as AnyRecord;

  if (part.type === ContentTypes.ERROR) {
    const errorField = partRecord[ContentTypes.ERROR];
    const textField = partRecord[ContentTypes.TEXT];
    const text =
      (typeof errorField === 'string' ? errorField : undefined) ??
      getTextValue(textField) ??
      '';
    const item: RenderableError = {
      kind: 'error',
      source: 'content_part',
      renderKey: `${renderKey}-error`,
      index,
      metadata: {},
      text,
    };
    return item;
  }

  if (part.type === ContentTypes.AGENT_UPDATE) {
    const update = partRecord[ContentTypes.AGENT_UPDATE] as AnyRecord | undefined;
    const agentId = typeof update?.agentId === 'string' ? update.agentId : '';
    const item: RenderableAgentUpdate = {
      kind: 'agent_update',
      source: 'content_part',
      renderKey: `${renderKey}-agent`,
      index,
      metadata: {},
      agentId,
    };
    return item;
  }

  if (part.type === ContentTypes.THINK) {
    const thinking = getTextValue(partRecord.think);
    if (thinking == null) return null;
    const item: RenderableThink = {
      kind: 'think',
      source: 'content_part',
      renderKey: `${renderKey}-think`,
      index,
      metadata: {},
      reasoning: thinking,
      isLast: isLastPart,
    };
    return item;
  }

  if (part.type === ContentTypes.SUMMARY) {
    const sp = part as unknown as RenderableSummary;
    const item: RenderableSummary = {
      kind: 'summary',
      source: 'content_part',
      renderKey: `${renderKey}-summary`,
      index,
      metadata: {},
      content: sp.content ?? [],
      model: sp.model,
      provider: sp.provider,
      tokenCount: sp.tokenCount,
      summarizing: sp.summarizing,
    };
    return item;
  }

  if (part.type === ContentTypes.IMAGE_FILE) {
    const imageFile = partRecord[ContentTypes.IMAGE_FILE] as AnyRecord | undefined;
    const fileId = typeof imageFile?.file_id === 'string' ? imageFile.file_id : undefined;
    const filepath = typeof imageFile?.filepath === 'string' ? imageFile.filepath : undefined;
    const filename = typeof imageFile?.filename === 'string' ? imageFile.filename : 'Uploaded Image';
    const cached = fileId ? getCachedPreview(fileId) : undefined;
    const imagePath = cached ?? filepath;
    if (!imagePath) return null;
    const item: RenderableImage = {
      kind: 'image',
      source: 'content_part',
      renderKey: `${renderKey}-image`,
      index,
      metadata: {},
      imagePath,
      altText: filename,
      width: typeof imageFile?.width === 'number' ? imageFile.width : undefined,
      height: typeof imageFile?.height === 'number' ? imageFile.height : undefined,
    };
    return item;
  }

  if (part.type === ContentTypes.TOOL_CALL) {
    return parseToolCallPart(part, index, context);
  }

  if (part.type === ContentTypes.TEXT) {
    const text = getTextValue(partRecord.text);
    if (text == null) return null;
    const hasToolCallIds = partRecord.tool_call_ids != null;
    if (hasToolCallIds && text === '') return null;
    if (text.length > 0 && /^\s*$/.test(text)) {
      if (isLastPart && isSubmitting) {
        const cursor: RenderableEmptyCursor = {
          kind: 'empty_cursor',
          source: 'content_part',
          renderKey: `${renderKey}-cursor`,
          index,
          metadata: {},
        };
        return cursor;
      }
      if (!isLastPart) return null;
    }
    const item: RenderableText = {
      kind: 'text',
      source: 'content_part',
      renderKey,
      index,
      metadata: { hasToolCallIds },
      text,
      showCursor: isLastPart && isLast,
    };
    return item;
  }

  return null;
};

const parseToolCallPart = (
  part: TMessageContentParts,
  index: number,
  context: PartToRenderableContext,
): RenderableToolCall | null => {
  const { messageId, attachmentMap, isSubmitting, isLast } = context;
  const partRecord = part as unknown as AnyRecord;
  const toolCall = partRecord[ContentTypes.TOOL_CALL] as AnyRecord | undefined;
  if (!toolCall) return null;

  const callId =
    typeof (toolCall as Agents.ToolCall).id === 'string'
      ? (toolCall as Agents.ToolCall).id
      : '';
  const partAttachments = attachmentMap && callId ? attachmentMap[callId] : undefined;

  const callType = String(toolCall.type ?? '');
  const hasArgs = 'args' in toolCall;
  const isStandard = hasArgs && (callType === '' || callType === ToolCallTypes.TOOL_CALL);

  let toolName: string;
  let args: string | AnyRecord | undefined;
  let output: string | undefined;
  let auth: string | undefined;

  if (isStandard) {
    toolName = String((toolCall as Agents.ToolCall).name ?? '');
    args = (toolCall as Agents.ToolCall).args as string | AnyRecord | undefined;
    output = typeof (toolCall as Agents.ToolCall).output === 'string'
      ? (toolCall as Agents.ToolCall).output
      : undefined;
    auth = typeof (toolCall as Agents.ToolCall).auth === 'string'
      ? (toolCall as Agents.ToolCall).auth
      : undefined;
  } else if (callType === ToolCallTypes.FUNCTION && 'function' in toolCall) {
    const func = (toolCall as AnyRecord & { function?: AnyRecord }).function;
    toolName = String(func?.name ?? '');
    args = func?.arguments as string | AnyRecord | undefined;
    output = typeof func?.output === 'string' ? func.output : undefined;
  } else {
    toolName = callType;
  }

  const toolKind = resolveToolKind(toolName, toolCall);
  const progress = typeof toolCall.progress === 'number' ? toolCall.progress : 0.1;

  if (toolKind === 'image_vision' && !isSubmitting) {
    return null;
  }

  const item: RenderableToolCall = {
    kind: 'tool_call',
    source: 'content_part',
    renderKey: `${messageId}-part-${index}-tool-${toolName}`,
    index,
    metadata: {
      callType,
      isStandard,
    },
    toolKind,
    toolName,
    toolCallId: callId || undefined,
    initialProgress: progress,
    args,
    output,
    auth,
    attachments: partAttachments,
    toolCall,
    isSubmitting,
    isLast,
  };
  return item;
};

const resolveToolKind = (toolName: string, toolCall: AnyRecord): string => {
  if (isBashProgrammaticToolCall(toolName, (toolCall as Agents.ToolCall).args)) {
    return 'bash_programmatic';
  }
  if (
    toolName === String(Tools.execute_code) ||
    toolName === String(Constants.PROGRAMMATIC_TOOL_CALLING) ||
    toolName === String(Constants.BASH_PROGRAMMATIC_TOOL_CALLING)
  ) {
    return 'execute_code';
  }
  if (['image_gen_oai', 'image_edit_oai', 'gemini_image_gen'].includes(toolName)) {
    return 'image_gen';
  }
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
  if (callType === ToolCallTypes.RETRIEVAL || callType === ToolCallTypes.FILE_SEARCH) {
    return 'retrieval';
  }
  if (callType === ToolCallTypes.FUNCTION && 'function' in toolCall) {
    const func = (toolCall as AnyRecord & { function?: AnyRecord }).function;
    const funcName = String(func?.name ?? '');
    if (funcName && imageGenTools.has(funcName)) return 'image_gen';
    if (isImageVisionTool(toolCall as never)) return 'image_vision';
    return 'function_call';
  }

  return 'generic_tool';
};

export const attachmentToRenderable = (
  attachment: TAttachment,
  index: number,
): RenderableAttachment | RenderableArtifact | null => {
  if (attachment.type === String(Tools.web_search)) return null;
  if (isInternalSandboxArtifact(attachment)) return null;

  const artType = artifactTypeForAttachment(attachment);
  if (artType === TOOL_ARTIFACT_TYPES.MERMAID) {
    const item: RenderableArtifact = {
      kind: 'artifact',
      source: 'artifact',
      renderKey: renderAttachmentKey('artifact', attachment, index),
      index,
      metadata: {},
      attachment,
      artifactType: TOOL_ARTIFACT_TYPES.MERMAID,
    };
    return item;
  }
  if (artType != null) {
    const item: RenderableArtifact = {
      kind: 'artifact',
      source: 'artifact',
      renderKey: renderAttachmentKey('artifact', attachment, index),
      index,
      metadata: {},
      attachment,
      artifactType: artType as ToolArtifactType,
    };
    return item;
  }

  let attachmentType: RenderableAttachment['attachmentType'];
  if (isImageAttachment(attachment)) attachmentType = 'image';
  else if (isTextAttachment(attachment)) attachmentType = 'text';
  else attachmentType = 'file';

  const item: RenderableAttachment = {
    kind: 'attachment',
    source: 'attachment',
    renderKey: renderAttachmentKey('attachment', attachment, index),
    index,
    metadata: {},
    attachment,
    attachmentType,
  };
  return item;
};

export const legacyTextToRenderable = (
  text: string,
  index: number,
  context: {
    messageId: string;
    isLast?: boolean;
    isSubmitting?: boolean;
    isCreatedByUser?: boolean;
  },
): RenderableText => {
  return {
    kind: 'text',
    source: 'legacy_message',
    renderKey: `${context.messageId}-legacy-text-${index}`,
    index,
    metadata: {},
    text,
    showCursor: context.isLast,
  };
};

export const pendingSkillToRenderable = (
  skillName: string,
  loaded: boolean,
  index: number,
  messageId: string,
): RenderablePendingSkill => ({
  kind: 'pending_skill',
  source: 'pending',
  renderKey: `${messageId}-pending-skill-${skillName}`,
  index,
  metadata: {},
  skillName,
  loaded,
});

export function hasRealContent(content: TMessageContentParts[] | undefined): boolean {
  return (content ?? []).some((part) => {
    if (part == null) return false;
    if (part.type !== ContentTypes.TEXT) return true;
    const text = getTextValue((part as AnyRecord).text);
    return (text ?? '').length > 0;
  });
}

export interface ParsedMessageContent {
  items: RenderableItem[];
  groups: RenderableItemGroup[];
  hasParallelContent: boolean;
  hasPendingSkills: boolean;
  attachmentItems: (RenderableAttachment | RenderableArtifact)[];
}

export function parseMessageContent(
  options: ParseMessageContentOptions & { attachmentMap?: AttachmentMap },
): ParsedMessageContent {
  const {
    messageId,
    content,
    attachments,
    attachmentMap: externalAttachmentMap,
    manualSkills,
    isSubmitting = false,
    isLast = false,
    isCreatedByUser = false,
    isLatestMessage = false,
  } = options;

  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
  const items: RenderableItem[] = [];
  const attachmentItems: (RenderableAttachment | RenderableArtifact)[] = [];
  let idx = 0;

  if (attachments && attachments.length > 0) {
    attachments.forEach((att, attIdx) => {
      const r = attachmentToRenderable(att, attIdx);
      if (r) attachmentItems.push(r);
    });
  }

  const isContentPresent = content != null && content.length > 0;
  const safeContent = content ?? [];
  const lastContentIdx = safeContent.length - 1;

  const pendingSkills: string[] =
    !isCreatedByUser && manualSkills != null ? manualSkills : [];
  const loaded = hasRealContent(content);
  pendingSkills.forEach((skillName, skillIdx) => {
    items.push(pendingSkillToRenderable(skillName, loaded, idx++, messageId));
  });

  if (!isContentPresent && effectiveIsSubmitting) {
    items.push({
      kind: 'empty_cursor',
      source: 'content_part',
      renderKey: `${messageId}-empty-cursor`,
      index: idx++,
      metadata: {},
    } as RenderableItem);
  }

  const partContext: PartToRenderableContext = {
    messageId,
    attachments,
    attachmentMap: externalAttachmentMap,
    isSubmitting: effectiveIsSubmitting,
    isLast,
  };

  safeContent.forEach((part, partIdx) => {
    if (!part) return;
    const renderable = partToRenderable(part, idx++, {
      ...partContext,
      isLastPart: partIdx === lastContentIdx,
    });
    if (renderable) items.push(renderable);
  });

  const hasParallelContent = safeContent.some(
    (part) => (part as AnyRecord)?.groupId != null,
  );

  return {
    items,
    groups: [],
    hasParallelContent,
    hasPendingSkills: pendingSkills.length > 0,
    attachmentItems,
  };
}

export function renderableKindOf(item: RenderableItem): RenderableKind {
  return item.kind;
}

export function renderableSourceOf(item: RenderableItem): RenderableSource {
  return item.source;
}

export function isEditablePart(part: TMessageContentParts): boolean {
  if (!part) return false;
  const isTextPart =
    part.type === ContentTypes.TEXT ||
    typeof (part as AnyRecord).text === 'string';
  const isThinkPart =
    part.type === ContentTypes.THINK ||
    typeof (part as AnyRecord).think === 'string';
  if (!isTextPart && !isThinkPart) return false;
  const isToolCall = part.type === ContentTypes.TOOL_CALL || (part as AnyRecord).tool_call_ids != null;
  return !isToolCall;
}

export function getToolCallId(part: TMessageContentParts): string {
  return (part?.[ContentTypes.TOOL_CALL] as Agents.ToolCall | undefined)?.id ?? '';
}
