import { useMemo } from 'react';
import type {
  TMessageContentParts,
  TAttachment,
  TMessage,
} from 'librechat-data-provider';
import {
  parseMessageContent,
  hasRealContent as checkRealContent,
  partToRenderable,
  attachmentToRenderable,
  type ParsedMessageContent,
  type ParseMessageContentOptions,
} from '~/components/Chat/Messages/Content/parser';
import type {
  RenderableItem,
  RenderableAttachment,
  RenderableArtifact,
} from '~/components/Chat/Messages/Content/parser/types';

export interface UseParsedMessageContentOptions
  extends Omit<ParseMessageContentOptions, 'messageId'> {
  messageId: string;
}

export function useParsedMessageContent(
  options: UseParsedMessageContentOptions,
): ParsedMessageContent {
  return useMemo(() => parseMessageContent(options), [
    options.messageId,
    options.content,
    options.attachments,
    options.manualSkills,
    options.isSubmitting,
    options.isLast,
    options.isCreatedByUser,
    options.isLatestMessage,
  ]);
}

export function useRenderableParts(props: {
  messageId: string;
  content?: TMessageContentParts[];
  attachments?: TAttachment[];
  isSubmitting?: boolean;
  isLast?: boolean;
  isLatestMessage?: boolean;
}): RenderableItem[] {
  const { messageId, content, attachments, isSubmitting, isLast, isLatestMessage } = props;
  return useMemo(() => {
    const result: RenderableItem[] = [];
    const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;
    const safeContent = content ?? [];
    const lastContentIdx = safeContent.length - 1;
    safeContent.forEach((part, partIdx) => {
      if (!part) return;
      const item = partToRenderable(part, result.length, {
        messageId,
        attachments,
        isSubmitting: effectiveIsSubmitting,
        isLast,
        isLastPart: partIdx === lastContentIdx,
      });
      if (item) result.push(item);
    });
    return result;
  }, [messageId, content, attachments, isSubmitting, isLast, isLatestMessage]);
}

export function useRenderableAttachments(attachments?: TAttachment[]): (
  | RenderableAttachment
  | RenderableArtifact
)[] {
  return useMemo(() => {
    const result: (RenderableAttachment | RenderableArtifact)[] = [];
    (attachments ?? []).forEach((att, idx) => {
      const item = attachmentToRenderable(att, idx);
      if (item) result.push(item);
    });
    return result;
  }, [attachments]);
}

export function useHasRealContent(content?: TMessageContentParts[]): boolean {
  return useMemo(() => checkRealContent(content), [content]);
}
