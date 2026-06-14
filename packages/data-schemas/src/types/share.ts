import type { Types } from 'mongoose';
import type { IMessage } from './message';
import type { PublicMessage, PublicContentPart, PublicAttachmentSummary, ToolCallSummary, ArtifactSummary } from '../serializers';

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
 * A file or attachment as exposed through a public shared link: storage- and
 * identity-internal fields are stripped, but render-relevant data (including
 * dynamic tool-call payloads keyed by tool name) is preserved.
 */
export type SharedFile = Record<string, unknown>;

/**
 * Public, anonymized projection of a message returned by a shared link. Only
 * render-relevant fields are surfaced; internal fields (user, endpoint,
 * conversationSignature, clientId, plugin(s), metadata, etc.) are omitted.
 * Unified with PublicMessage serializer to ensure consistent filtering across
 * all public-facing APIs (share, search, export, display).
 */
export type SharedMessage = PublicMessage & {
  content?: PublicContentPart[];
  attachments?: PublicAttachmentSummary[];
  toolCalls?: ToolCallSummary[];
  artifacts?: ArtifactSummary[];
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
