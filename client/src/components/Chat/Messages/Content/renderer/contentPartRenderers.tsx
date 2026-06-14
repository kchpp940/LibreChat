import { memo } from 'react';
import type { TMessageContentParts, TAttachment } from 'librechat-data-provider';
import { ContentTypes } from 'librechat-data-provider';
import type { ContentPartRenderer, ContentPartRendererProps } from './types';
import {
  AgentUpdate,
  EmptyText,
  Reasoning,
  Summary,
  Text,
} from '../Parts';
import { ErrorMessage } from '../MessageContent';
import { getCachedPreview } from '~/utils';
import Container from '../Container';
import Image from '../Image';

type AnyRecord = Record<string, unknown>;

const DefaultErrorRenderer = memo(function DefaultErrorRenderer(props: ContentPartRendererProps) {
  const part = props.part as unknown as AnyRecord;
  const errorPart = part[ContentTypes.ERROR];
  const textPart = part[ContentTypes.TEXT];
  const errorText =
    (typeof errorPart === 'string' ? errorPart : undefined) ??
    (typeof textPart === 'string'
      ? textPart
      : typeof (textPart as AnyRecord)?.value === 'string'
        ? (textPart as AnyRecord).value
        : undefined) ??
    '';
  return <ErrorMessage text={String(errorText)} className="my-2" />;
});

const DefaultAgentUpdateRenderer = memo(function DefaultAgentUpdateRenderer(
  props: ContentPartRendererProps,
) {
  const { part, isLast, showCursor } = props;
  const agentUpdate = part[ContentTypes.AGENT_UPDATE] as AnyRecord | undefined;
  const agentId = typeof agentUpdate?.agentId === 'string' ? agentUpdate.agentId : '';
  return (
    <>
      <AgentUpdate currentAgentId={agentId} />
      {isLast && showCursor && (
        <Container>
          <EmptyText />
        </Container>
      )}
    </>
  );
});

const DefaultTextRenderer = memo(function DefaultTextRenderer(props: ContentPartRendererProps) {
  const { part, isCreatedByUser, showCursor, isLast } = props;
  const partRecord = part as unknown as AnyRecord;
  const textField = partRecord.text;
  const text =
    typeof textField === 'string'
      ? textField
      : typeof (textField as AnyRecord)?.value === 'string'
        ? (textField as AnyRecord).value as string
        : undefined;

  if (typeof text !== 'string') {
    return null;
  }
  if (partRecord.tool_call_ids != null && !text) {
    return null;
  }
  if (text.length > 0 && /^\s*$/.test(text)) {
    if (isLast && showCursor) {
      return (
        <Container>
          <EmptyText />
        </Container>
      );
    }
    if (!isLast) {
      return null;
    }
  }
  return (
    <Container>
      <Text text={text} isCreatedByUser={isCreatedByUser} showCursor={showCursor} />
    </Container>
  );
});

const DefaultThinkRenderer = memo(function DefaultThinkRenderer(props: ContentPartRendererProps) {
  const { part, isLast } = props;
  const partRecord = part as unknown as AnyRecord;
  const thinkField = partRecord.think;
  const reasoning =
    typeof thinkField === 'string'
      ? thinkField
      : typeof (thinkField as AnyRecord)?.value === 'string'
        ? (thinkField as AnyRecord).value as string
        : undefined;
  if (typeof reasoning !== 'string') {
    return null;
  }
  return <Reasoning reasoning={reasoning} isLast={isLast ?? false} />;
});

const DefaultSummaryRenderer = memo(function DefaultSummaryRenderer(props: ContentPartRendererProps) {
  const part = props.part as unknown as {
    content?: { type: ContentTypes.TEXT; text: string }[];
    model?: string;
    provider?: string;
    tokenCount?: number;
    summarizing?: boolean;
  };
  return (
    <Summary
      content={part.content ?? []}
      model={part.model}
      provider={part.provider}
      tokenCount={part.tokenCount}
      summarizing={part.summarizing}
    />
  );
});

const DefaultImageRenderer = memo(function DefaultImageRenderer(props: ContentPartRendererProps) {
  const part = props.part;
  const imageFile = part[ContentTypes.IMAGE_FILE] as unknown as {
    file_id?: string;
    filepath?: string;
    filename?: string;
    width?: number;
    height?: number;
  };
  const cached = imageFile.file_id ? getCachedPreview(imageFile.file_id) : undefined;
  const imagePath = cached ?? imageFile.filepath ?? '';
  if (!imagePath) {
    return null;
  }
  return (
    <Image
      imagePath={imagePath}
      altText={imageFile.filename ?? 'Uploaded Image'}
      width={imageFile.width}
      height={imageFile.height}
    />
  );
});

export const contentPartRenderers: ContentPartRenderer[] = [
  {
    id: 'content-error',
    name: 'Error Content Part',
    type: ContentTypes.ERROR,
    priority: 100,
    match: (part: TMessageContentParts) => ({ matched: part.type === ContentTypes.ERROR }),
    render: DefaultErrorRenderer,
  },
  {
    id: 'content-agent-update',
    name: 'Agent Update',
    type: ContentTypes.AGENT_UPDATE,
    priority: 95,
    match: (part: TMessageContentParts) => ({ matched: part.type === ContentTypes.AGENT_UPDATE }),
    render: DefaultAgentUpdateRenderer,
  },
  {
    id: 'content-think',
    name: 'Reasoning / Thinking',
    type: ContentTypes.THINK,
    priority: 90,
    match: (part: TMessageContentParts) => ({ matched: part.type === ContentTypes.THINK }),
    render: DefaultThinkRenderer,
  },
  {
    id: 'content-summary',
    name: 'Summary Content',
    type: ContentTypes.SUMMARY,
    priority: 85,
    match: (part: TMessageContentParts) => ({ matched: part.type === ContentTypes.SUMMARY }),
    render: DefaultSummaryRenderer,
  },
  {
    id: 'content-image-file',
    name: 'Image File',
    type: ContentTypes.IMAGE_FILE,
    priority: 80,
    match: (part: TMessageContentParts) => ({ matched: part.type === ContentTypes.IMAGE_FILE }),
    render: DefaultImageRenderer,
  },
  {
    id: 'content-text',
    name: 'Text Content',
    type: ContentTypes.TEXT,
    priority: 10,
    match: (part: TMessageContentParts) => ({ matched: part.type === ContentTypes.TEXT }),
    render: DefaultTextRenderer,
  },
];

export default contentPartRenderers;
