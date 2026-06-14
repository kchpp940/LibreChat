import { memo, ReactNode } from 'react';
import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import { ContentTypes } from 'librechat-data-provider';
import { RendererRegistry } from './RendererRegistry';
import type {
  ContentPartRendererProps,
  ToolCallRendererProps,
  AttachmentRendererProps,
  ToolCallMatchInput,
} from './types';
import { contentPartRenderers } from './contentPartRenderers';
import { toolCallRenderers } from './toolCallRenderers';
import { attachmentRenderers } from './attachmentRenderers';
import type { BaseRenderer } from './RendererRegistry';

const contentPartRegistry = new RendererRegistry<
  ContentPartRendererProps,
  TMessageContentParts
>();
const toolCallRegistry = new RendererRegistry<ToolCallRendererProps, ToolCallMatchInput>();
const attachmentRegistry = new RendererRegistry<
  AttachmentRendererProps,
  TAttachment
>();

contentPartRenderers.forEach((r) => contentPartRegistry.register(r));
toolCallRenderers.forEach((r) => toolCallRegistry.register(r));
attachmentRenderers.forEach(
  (r) =>
    attachmentRegistry.register(
      r as BaseRenderer<AttachmentRendererProps, TAttachment>,
    ),
);

type AnyRecord = Record<string, unknown>;

export interface RenderContentPartProps extends ContentPartRendererProps {}

export const RenderContentPart = memo(function RenderContentPart(
  props: RenderContentPartProps,
): ReactNode {
  const { part } = props;

  if (!part) {
    return null;
  }

  if (part.type === ContentTypes.TOOL_CALL) {
    return <RenderToolCallContent {...props} />;
  }

  const renderer = contentPartRegistry.match(part);
  if (renderer) {
    const RenderComponent = renderer.render;
    return <RenderComponent {...props} />;
  }

  return null;
});

export const RenderToolCallContent = memo(function RenderToolCallContent(
  props: RenderContentPartProps,
): ReactNode {
  const { part, isSubmitting, attachments, hideAttachments, onToolExpand, isLast, showCursor, isCreatedByUser } = props;

  if (!part || part.type !== ContentTypes.TOOL_CALL) {
    return null;
  }

  const toolCall = part[ContentTypes.TOOL_CALL] as AnyRecord | undefined;
  if (!toolCall) {
    return null;
  }

  const callType = String(toolCall.type ?? '');
  const hasArgs = 'args' in toolCall;
  const isToolCall = hasArgs && (callType === '' || callType === 'tool_call');

  let toolName: string;
  if (isToolCall) {
    toolName = String(toolCall.name ?? '');
  } else if (callType === 'function' && 'function' in toolCall) {
    const func = (toolCall as AnyRecord & { function?: AnyRecord }).function;
    toolName = String(func?.name ?? '');
  } else {
    toolName = callType;
  }

  const renderer = toolCallRegistry.match({ toolName, toolCall });

  if (renderer) {
    const initialProgress =
      typeof (toolCall as AnyRecord).progress === 'number'
        ? ((toolCall as AnyRecord).progress as number)
        : 0.1;
    let output: string | undefined;
    let args: string | AnyRecord | undefined;
    let auth: boolean | undefined;

    if (isToolCall) {
      output = typeof toolCall.output === 'string' ? toolCall.output : undefined;
      args = (toolCall.args as string | AnyRecord | undefined);
      auth = typeof toolCall.auth === 'boolean' ? toolCall.auth : undefined;
    } else if ('function' in toolCall) {
      const funcCall = toolCall as AnyRecord & { function?: AnyRecord };
      const func = funcCall.function;
      if (func) {
        output = typeof func.output === 'string' ? func.output : undefined;
        args = (func.arguments as string | AnyRecord | undefined);
      }
    }

    const RenderComponent = renderer.render;
    const toolProps: ToolCallRendererProps & {
      isSubmitting?: boolean;
      showCursor?: boolean;
      isCreatedByUser?: boolean;
    } = {
      toolCall,
      toolName,
      isSubmitting,
      attachments,
      hideAttachments,
      onToolExpand,
      isLast,
      initialProgress,
      output,
      args,
      auth,
    };

    if (renderer.id === 'tool-image-vision-skip') {
      toolProps.isSubmitting = isSubmitting;
      toolProps.showCursor = showCursor;
      toolProps.isCreatedByUser = isCreatedByUser;
    }

    return <RenderComponent {...(toolProps as ToolCallRendererProps)} />;
  }

  return null;
});

export interface RenderAttachmentProps {
  attachment?: TAttachment;
}

export const RenderAttachment = memo(function RenderAttachment({
  attachment,
}: RenderAttachmentProps): ReactNode {
  if (!attachment) {
    return null;
  }

  const renderer = attachmentRegistry.match(attachment);
  if (renderer) {
    const RenderComponent = renderer.render;
    const attachmentProps: AttachmentRendererProps = { attachment };
    return <RenderComponent {...attachmentProps} />;
  }

  return null;
});

export function findContentPartRenderer(
  part: TMessageContentParts,
) {
  return contentPartRegistry.match(part);
}

export function findToolCallRenderer(toolName: string, toolCall: AnyRecord) {
  return toolCallRegistry.match({ toolName, toolCall });
}

export function findAttachmentRenderer(attachment: TAttachment) {
  return attachmentRegistry.match(attachment);
}
