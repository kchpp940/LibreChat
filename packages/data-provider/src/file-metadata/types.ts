import type { EToolResources } from '../types/assistants';
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
   * @deprecated Use `display.textFormat` instead.
   */
  textFormat?: 'html' | 'text' | null;
  status?: 'pending' | 'ready' | 'failed';
  previewError?: string;
  purpose?: FilePurpose;
  indexingStatus?: IndexingStatus;
  visibility?: FileVisibility;
  display?: FileDisplayMetadata;
  metadata?: {
    fileIdentifier?: string;
    codeEnvRef?: CodeEnvRef;
    indexingError?: string;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type TFileUpload = TFile & {
  temp_file_id: string;
};

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

export type UnifiedFileLike = Partial<TFile> | {
  embedded?: boolean;
  indexingStatus?: IndexingStatus;
  purpose?: FilePurpose;
  visibility?: FileVisibility;
  display?: FileDisplayMetadata;
  type?: string;
  filename?: string;
  context?: FileContext;
  source?: FileSources;
  width?: number;
  height?: number;
  text?: string;
  textFormat?: 'html' | 'text' | null;
  metadata?: {
    fileIdentifier?: string;
    codeEnvRef?: CodeEnvRef;
    indexingError?: string;
    [key: string]: unknown;
  };
};
