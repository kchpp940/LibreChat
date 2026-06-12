import type { Types } from 'mongoose';
import type { IMessage } from './message';

export interface ISharedLink {
  _id?: Types.ObjectId;
  conversationId: string;
  title?: string;
  user?: string;
  messages?: Types.ObjectId[];
  shareId?: string;
  targetMessageId?: string;
  expiredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  /** Owning tenant for multi-tenant deployments (read by the shared-link access middleware). */
  tenantId?: string;
}

export interface ShareServiceError extends Error {
  code: string;
}

/**
 * A file or attachment as exposed through a public shared link.
 *
 * STRICT WHITELIST ONLY: this type mirrors `share.ts`'s
 * `SHARED_FILE_WHITELIST`. No storage-internal field (filepath, preview,
 * file_id, /api/files/* URLs, storage keys, metadata) is present; the
 * backend drops everything not on the list. Render-only fields such as
 * `text` (extracted text) and image dimensions are preserved for the
 * share renderer; `messageId`/`conversationId`/`toolCallId` carry only
 * the anonymized tokens assigned by the share serializer.
 *
 * Tool payloads (file_search, web_search) are individually sanitized
 * to strip internal file ids and arbitrary metadata.
 */
export type SharedFile = Record<string, unknown> & {
  filename?: string;
  bytes?: number;
  size?: number;
  width?: number;
  height?: number;
  text?: string;
  textFormat?: string;
  type?: string;
  toolCallId?: string;
  status?: string;
  previewError?: string;
  messageId?: string;
  conversationId?: string;
  file_search?: {
    sources?: Array<{
      fileName?: string;
      pages?: number[];
      relevance?: number;
      pageRelevance?: Record<string, number>;
      fileId?: string;
    }>;
    turn?: number;
  };
  web_search?: {
    turn?: number;
    organic?: Array<Record<string, unknown>>;
    topStories?: Array<Record<string, unknown>>;
    images?: Array<Record<string, unknown>>;
    references?: Array<Record<string, unknown>>;
  };
};

/**
 * Public, anonymized projection of a message returned by a shared link.
 *
 * ONLY render-relevant fields are surfaced. Every internal message field
 * (endpoint, conversationSignature, clientId, plugin(s), metadata,
 * tokenCount, finish_reason, skill configuration, agent ids, embedding
 * config, etc.) is dropped by the backend regardless of the type
 * definition. The `content` array passes through the content-part
 * whitelist (see `sanitizeContent` in share.ts).
 */
export type SharedMessage = {
  messageId: string;
  parentMessageId: string | null;
  conversationId: string;
  sender: string;
  text: string | null;
  content?: unknown[];
  iconURL?: string;
  model?: string;
  isCreatedByUser: boolean;
  createdAt: string | number | Date;
  updatedAt?: string | number | Date;
  unfinished?: boolean;
  error?: boolean;
  files?: SharedFile[];
  attachments?: SharedFile[];
};

export interface SharedLinksResult {
  links: Array<{
    shareId: string;
    title: string;
    createdAt: Date;
    conversationId: string;
  }>;
  nextCursor?: Date;
  hasNextPage: boolean;
}

export interface SharedMessagesResult {
  conversationId: string;
  messages: Array<SharedMessage>;
  shareId: string;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateShareResult {
  _id?: string;
  shareId: string;
  conversationId: string;
  targetMessageId?: string;
}

export interface UpdateShareResult {
  _id?: string;
  shareId: string;
  conversationId: string;
  targetMessageId?: string;
}

export interface DeleteShareResult {
  _id?: string;
  success: boolean;
  shareId: string;
  message: string;
}

export interface GetShareLinkResult {
  _id?: string;
  shareId: string | null;
  targetMessageId?: string;
  success: boolean;
}

export interface DeleteAllSharesResult {
  message: string;
  deletedCount: number;
}
