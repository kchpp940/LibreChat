import { EToolResources } from './assistants';
import type { CodeEnvRef } from '../codeEnvRef';

export enum FileSources {
  local = 'local',
  firebase = 'firebase',
  azure = 'azure',
  azure_blob = 'azure_blob',
  openai = 'openai',
  s3 = 's3',
  cloudfront = 'cloudfront',
  vectordb = 'vectordb',
  execute_code = 'execute_code',
  mistral_ocr = 'mistral_ocr',
  azure_mistral_ocr = 'azure_mistral_ocr',
  vertexai_mistral_ocr = 'vertexai_mistral_ocr',
  text = 'text',
  document_parser = 'document_parser',
}

export const checkOpenAIStorage = (source: string) =>
  source === FileSources.openai || source === FileSources.azure;

export enum FileContext {
  avatar = 'avatar',
  unknown = 'unknown',
  agents = 'agents',
  assistants = 'assistants',
  execute_code = 'execute_code',
  image_generation = 'image_generation',
  assistants_output = 'assistants_output',
  message_attachment = 'message_attachment',
  skill_file = 'skill_file',
  filename = 'filename',
  updatedAt = 'updatedAt',
  source = 'source',
  filterSource = 'filterSource',
  context = 'context',
  bytes = 'bytes',
}

export enum FilePurpose {
  message_attachment = 'message_attachment',
  rag_knowledge = 'rag_knowledge',
  agent_resource = 'agent_resource',
  assistant_resource = 'assistant_resource',
  code_execution_output = 'code_execution_output',
  image_generation_result = 'image_generation_result',
  tool_output = 'tool_output',
  skill_file = 'skill_file',
  avatar = 'avatar',
  unknown = 'unknown',
  vision = 'vision',
  fine_tune = 'fine-tune',
  fine_tune_results = 'fine-tune-results',
  assistants = 'assistants',
  assistants_output = 'assistants_output',
}

export enum IndexingStatus {
  not_required = 'not_required',
  pending = 'pending',
  indexing = 'indexing',
  completed = 'completed',
  failed = 'failed',
}

export enum FileVisibility {
  private = 'private',
  conversation = 'conversation',
  workspace = 'workspace',
  public = 'public',
}

export type FileDisplayMetadata = {
  width?: number;
  height?: number;
  text?: string;
  textFormat?: 'html' | 'text' | null;
  pageCount?: number;
  duration?: number;
};

export const purposeFromContext = (context?: FileContext): FilePurpose => {
  switch (context) {
    case FileContext.message_attachment:
      return FilePurpose.message_attachment;
    case FileContext.agents:
      return FilePurpose.agent_resource;
    case FileContext.assistants:
      return FilePurpose.assistant_resource;
    case FileContext.assistants_output:
      return FilePurpose.tool_output;
    case FileContext.execute_code:
      return FilePurpose.code_execution_output;
    case FileContext.image_generation:
      return FilePurpose.image_generation_result;
    case FileContext.skill_file:
      return FilePurpose.skill_file;
    case FileContext.avatar:
      return FilePurpose.avatar;
    default:
      return FilePurpose.unknown;
  }
};

export const indexingStatusFromEmbedded = (embedded?: boolean): IndexingStatus => {
  if (embedded === true) {
    return IndexingStatus.completed;
  }
  return IndexingStatus.not_required;
};

export const embeddedFromIndexingStatus = (status?: IndexingStatus): boolean => {
  return status === IndexingStatus.completed;
};

export type EndpointFileConfig = {
  disabled?: boolean;
  fileLimit?: number;
  fileSizeLimit?: number;
  totalSizeLimit?: number;
  supportedMimeTypes?: RegExp[];
};

export type FileConfig = {
  endpoints: {
    [key: string]: EndpointFileConfig;
  };
  skills?: {
    fileSizeLimit?: number;
  };
  fileTokenLimit?: number;
  serverFileSizeLimit?: number;
  avatarSizeLimit?: number;
  clientImageResize?: {
    enabled?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  };
  ocr?: {
    supportedMimeTypes?: RegExp[];
  };
  text?: {
    supportedMimeTypes?: RegExp[];
  };
  stt?: {
    supportedMimeTypes?: RegExp[];
  };
  checkType?: (fileType: string, supportedTypes: RegExp[]) => boolean;
};

export type FileConfigInput = {
  endpoints?: {
    [key: string]: EndpointFileConfig;
  };
  skills?: {
    fileSizeLimit?: number;
  };
  serverFileSizeLimit?: number;
  avatarSizeLimit?: number;
  clientImageResize?: {
    enabled?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  };
  ocr?: {
    supportedMimeTypes?: string[];
  };
  text?: {
    supportedMimeTypes?: string[];
  };
  stt?: {
    supportedMimeTypes?: string[];
  };
  checkType?: (fileType: string, supportedTypes: RegExp[]) => boolean;
};

export type TFile = {
  _id?: string;
  __v?: number;
  user: string;
  tenantId?: string;
  storageRegion?: string;
  storageKey?: string;
  conversationId?: string;
  message?: string;
  file_id: string;
  temp_file_id?: string;
  bytes: number;
  /** @deprecated Use `indexingStatus` instead. Maintained for backward compatibility. */
  embedded: boolean;
  filename: string;
  filepath: string;
  object: 'file';
  type: string;
  usage: number;
  context?: FileContext;
  source?: FileSources;
  filterSource?: FileSources;
  /** @deprecated Use `display.width` and `display.height` instead. */
  width?: number;
  /** @deprecated Use `display.width` and `display.height` instead. */
  height?: number;
  expiresAt?: string | Date;
  preview?: string;
  /** @deprecated Use `display.text` instead. */
  text?: string;
  /**
   * Format of the `text` field. `'html'` means the backend produced
   * a sanitized full-document HTML preview the client may inject as
   * `index.html` inside the office artifact iframe. `'text'` (or
   * `undefined` for legacy records) is plain text and MUST NOT be
   * injected as HTML — render through the markdown/escaping path.
   * See Codex P1 review on PR #12934.
   * @deprecated Use `display.textFormat` instead.
   */
  textFormat?: 'html' | 'text' | null;
  /**
   * Lifecycle of the inline preview rendered from `text`. `'pending'`
   * while background HTML extraction is in flight (deferred-preview
   * code-execution flow), `'ready'` once `text`/`textFormat` are set,
   * `'failed'` if extraction errored or hit the 60s ceiling. `undefined`
   * for legacy records and for files that never expect a preview —
   * clients MUST treat that as `'ready'`.
   */
  status?: 'pending' | 'ready' | 'failed';
  /**
   * Short machine-readable failure reason when `status === 'failed'`.
   * Suitable for tooltip text but not user-facing prose.
   */
  previewError?: string;
  /** Unified file purpose - replaces inference from context/source/type fields. */
  purpose?: FilePurpose;
  /** RAG indexing status - replaces `embedded` boolean with full lifecycle states. */
  indexingStatus?: IndexingStatus;
  /** File visibility scope. */
  visibility?: FileVisibility;
  /** Display metadata - unified location for all rendering-related fields. */
  display?: FileDisplayMetadata;
  metadata?: {
    fileIdentifier?: string;
    /**
     * Structured form of `fileIdentifier`. Persisted alongside the
     * legacy string during the dual-write transition; readers should
     * resolve via `resolveCodeEnvRef`.
     */
    codeEnvRef?: CodeEnvRef;
    /** Error details when indexingStatus === 'failed'. */
    indexingError?: string;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type TFileUpload = TFile & {
  temp_file_id: string;
};

/**
 * Shape returned by `GET /api/files/:file_id/preview`. The deferred-
 * preview code-execution flow polls this until status is terminal:
 *   - `pending`: HTML extraction is still running. No `text`.
 *   - `ready`: extraction succeeded; `text` + `textFormat` populated
 *     iff the file produced inline preview content (binary/oversized
 *     files reach `ready` with no text — render download-only).
 *   - `failed`: extraction errored or hit the 60s ceiling;
 *     `previewError` carries the short reason (`timeout`,
 *     `parser-error`, `orphaned`, etc.).
 *
 * Legacy records pre-dating the field are surfaced as `'ready'` server-
 * side so existing attachments keep rendering normally.
 */
export type TFilePreview = {
  file_id: string;
  status: 'pending' | 'ready' | 'failed';
  text?: string;
  textFormat?: 'html' | 'text' | null;
  previewError?: string;
};

export type AvatarUploadResponse = {
  url: string;
};

export type FileDownloadURLResponse = {
  url: string;
  filename: string;
  type: string;
  metadata: Partial<TFile>;
};

export type SpeechToTextResponse = {
  text: string;
};

export type VoiceResponse = string[];

export type UploadMutationOptions = {
  onSuccess?: (data: TFileUpload, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type UploadAvatarOptions = {
  onSuccess?: (data: AvatarUploadResponse, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type SpeechToTextOptions = {
  onSuccess?: (data: SpeechToTextResponse, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type TextToSpeechOptions = {
  onSuccess?: (data: ArrayBuffer, variables: FormData, context?: unknown) => void;
  onMutate?: (variables: FormData) => void | Promise<unknown>;
  onError?: (error: unknown, variables: FormData, context?: unknown) => void;
};

export type VoiceOptions = {
  onSuccess?: (data: VoiceResponse, variables: unknown, context?: unknown) => void;
  onMutate?: () => void | Promise<unknown>;
  onError?: (error: unknown, variables: unknown, context?: unknown) => void;
};

export type DeleteFilesResponse = {
  message: string;
  result: Record<string, unknown>;
};

export type BatchFile = {
  file_id: string;
  filepath: string;
  storageRegion?: string;
  storageKey?: string;
  /** @deprecated Use `indexingStatus` instead. */
  embedded: boolean;
  source: FileSources;
  temp_file_id?: string;
  purpose?: FilePurpose;
  indexingStatus?: IndexingStatus;
};

export function normalizeFileMetadata<T extends Partial<TFile>>(file: T): T {
  const normalized = { ...file };

  if (normalized.indexingStatus === undefined && normalized.embedded !== undefined) {
    normalized.indexingStatus = indexingStatusFromEmbedded(normalized.embedded);
  }
  if (normalized.embedded === undefined && normalized.indexingStatus !== undefined) {
    normalized.embedded = embeddedFromIndexingStatus(normalized.indexingStatus);
  }

  if (normalized.purpose === undefined && normalized.context !== undefined) {
    normalized.purpose = purposeFromContext(normalized.context);
  }

  if (normalized.visibility === undefined) {
    normalized.visibility = normalized.conversationId
      ? FileVisibility.conversation
      : FileVisibility.private;
  }

  if (normalized.display === undefined) {
    normalized.display = {
      width: normalized.width,
      height: normalized.height,
      text: normalized.text,
      textFormat: normalized.textFormat,
    };
  } else {
    if (normalized.display.width === undefined && normalized.width !== undefined) {
      normalized.display.width = normalized.width;
    }
    if (normalized.display.height === undefined && normalized.height !== undefined) {
      normalized.display.height = normalized.height;
    }
    if (normalized.display.text === undefined && normalized.text !== undefined) {
      normalized.display.text = normalized.text;
    }
    if (normalized.display.textFormat === undefined && normalized.textFormat !== undefined) {
      normalized.display.textFormat = normalized.textFormat;
    }
  }

  return normalized as T;
}

export function createFileDefaults(): Partial<TFile> {
  return {
    purpose: FilePurpose.unknown,
    indexingStatus: IndexingStatus.not_required,
    visibility: FileVisibility.private,
    display: {},
    embedded: false,
  };
}

export type DeleteFilesBody = {
  files: BatchFile[];
  agent_id?: string;
  assistant_id?: string;
  tool_resource?: EToolResources;
};

export type DeleteMutationOptions = {
  onSuccess?: (data: DeleteFilesResponse, variables: DeleteFilesBody, context?: unknown) => void;
  onMutate?: (variables: DeleteFilesBody) => void | Promise<unknown>;
  onError?: (error: unknown, variables: DeleteFilesBody, context?: unknown) => void;
};
