import type { IMessage } from '~/types/message';
import type { IConversation } from '~/types';
import logger from '~/config/winston';
import { publicMessageSerializer } from './publicMessage';
import { SerializerContext } from './types';
import type {
  PublicMessage,
  PublicAttachmentSummary,
  ToolCallSummary,
  ArtifactSummary,
  PublicContentPart,
} from './types';

const _serializer = publicMessageSerializer;
const SENSITIVE_MESSAGE_FIELDS = _serializer.SENSITIVE_MESSAGE_FIELDS;
const forShare = _serializer.forShare;
const forSearch = _serializer.forSearch;
const forExport = _serializer.forExport;
const _anonymizeConvoId = _serializer.anonymizeConvoId;
const _anonymizeAssistantId = _serializer.anonymizeAssistantId;
const _anonymizeMessageId = _serializer.anonymizeMessageId;
const _anonymizeModel = _serializer.anonymizeModel;

function assertNoSensitiveFields(
  output: Record<string, unknown>,
  scene: SerializerContext,
): void {
  const leaks: string[] = [];
  for (const key of Object.keys(output)) {
    if (SENSITIVE_MESSAGE_FIELDS.has(key)) {
      leaks.push(key);
    }
  }
  if (leaks.length > 0) {
    const err = new Error(
      `[publicMessageSerializer/${scene}] Sensitive field leak detected: ${leaks.join(', ')}`,
    );
    logger.error(err.message);
    throw err;
  }
}

function assertDeepNoSensitiveFields(
  messages: PublicMessage[],
  scene: SerializerContext,
): void {
  for (const msg of messages) {
    assertNoSensitiveFields(msg as unknown as Record<string, unknown>, scene);
    if (msg.content) {
      for (const part of msg.content) {
        assertNoSensitiveFields(part as unknown as Record<string, unknown>, scene);
      }
    }
    if (msg.attachments) {
      for (const att of msg.attachments) {
        assertNoSensitiveFields(att as unknown as Record<string, unknown>, scene);
      }
    }
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        assertNoSensitiveFields(tc as unknown as Record<string, unknown>, scene);
      }
    }
    if (msg.artifacts) {
      for (const art of msg.artifacts) {
        assertNoSensitiveFields(art as unknown as Record<string, unknown>, scene);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// SCENE 1 — SHARED LINK (share)
// ---------------------------------------------------------------------------

export interface SerializedSharedMessages {
  conversationId: string;
  title?: string | null;
  messages: Array<PublicMessage & {
    content?: PublicContentPart[];
    attachments?: PublicAttachmentSummary[];
    toolCalls?: ToolCallSummary[];
    artifacts?: ArtifactSummary[];
  }>;
  warnings: Array<{ messageId: string; warnings: string[] }>;
}

export function serializeSharedMessages(
  messages: IMessage[],
  shareConversationId: string,
): SerializedSharedMessages {
  const result = forShare(messages, shareConversationId);
  const outMessages = result.messages as unknown as SerializedSharedMessages['messages'];

  assertDeepNoSensitiveFields(outMessages as unknown as PublicMessage[], SerializerContext.SHARE);

  const perMessageWarnings: SerializedSharedMessages['warnings'] = [];
  for (let i = 0; i < result.warnings.length; i++) {
    perMessageWarnings.push({ messageId: messages[i]?.messageId ?? '', warnings: [result.warnings[i]] });
  }

  return {
    conversationId: result.conversationId,
    messages: outMessages,
    warnings: perMessageWarnings,
  };
}

// ---------------------------------------------------------------------------
// SCENE 2 — EXPORT (JSON/CSV/MD/TXT 外发文件)
// ---------------------------------------------------------------------------

export interface SerializedExportMessages {
  messages: PublicMessage[];
  warnings: Array<{ messageId: string; warnings: string[] }>;
}

export function serializeExportMessages(messages: IMessage[]): SerializedExportMessages {
  const outputMessages: PublicMessage[] = [];
  const warnings: SerializedExportMessages['warnings'] = [];

  for (const message of messages) {
    const result = forExport(message);
    outputMessages.push(result.message);
    if (result.warnings && result.warnings.length > 0) {
      warnings.push({ messageId: message.messageId, warnings: result.warnings });
    }
  }

  assertDeepNoSensitiveFields(outputMessages, SerializerContext.EXPORT);

  return {
    messages: outputMessages,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// SCENE 3 — SEARCH RESULTS (跨会话搜索摘要)
// ---------------------------------------------------------------------------

export interface SerializedSearchMessage extends Omit<PublicMessage, 'model'> {
  title?: string | null;
  conversationId: string;
  model?: string | null;
  endpoint?: string | null;
}

export function serializeSearchResults(
  rawEntries: Array<{ message: IMessage; title?: string | null; model?: string | null; endpoint?: string | null }>,
): { messages: SerializedSearchMessage[] } {
  const messages: SerializedSearchMessage[] = [];

  for (const entry of rawEntries) {
    const searchResult = forSearch(entry.message);
    messages.push({
      messageId: entry.message.messageId,
      conversationId: entry.message.conversationId,
      text: searchResult.text,
      isCreatedByUser: entry.message.isCreatedByUser,
      toolCalls: searchResult.toolCalls,
      createdAt: entry.message.createdAt,
      updatedAt: entry.message.updatedAt,
      parentMessageId: entry.message.parentMessageId,
      sender: entry.message.sender,
      error: entry.message.error,
      unfinished: entry.message.unfinished,
      iconURL: entry.message.iconURL,
      model: entry.model,
      title: entry.title,
      endpoint: entry.endpoint,
    } as SerializedSearchMessage);
  }

  assertDeepNoSensitiveFields(
    messages as unknown as PublicMessage[], SerializerContext.SEARCH);

  return { messages };
}

// ---------------------------------------------------------------------------
// SCENE 4 — SEARCH INDEXING (MeiliSearch 索引预处理)
// ---------------------------------------------------------------------------

export interface SerializedSearchIndexMessage {
  text: string;
  toolCalls?: ToolCallSummary[];
  strippedFields: string[];
}

export function serializeSearchIndexMessage(rawMessage: IMessage): SerializedSearchIndexMessage {
  const searchResult = forSearch(rawMessage);

  const strippedFields: string[] = [];
  for (const field of [
    'content',
    'metadata',
    'plugin',
    'plugins',
    'endpoint',
    'clientId',
    'conversationSignature',
    'invocationId',
    'thread_id',
    'contextMeta',
  ]) {
    strippedFields.push(field);
  }

  return {
    text: searchResult.text,
    toolCalls: searchResult.toolCalls,
    strippedFields,
  };
}

export function anonymizeConvoId(id: string): string {
  return _anonymizeConvoId(id);
}
export function anonymizeAssistantId(id: string): string {
  return _anonymizeAssistantId(id);
}
export function anonymizeMessageId(id: string): string {
  return _anonymizeMessageId(id);
}
export function anonymizeModel(model: string): string | undefined {
  return _anonymizeModel(model);
}
