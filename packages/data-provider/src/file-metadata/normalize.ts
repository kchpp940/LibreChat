import {
  FileContext,
  FilePurpose,
  FileVisibility,
  IndexingStatus,
} from './types';
import type { TFile } from './types';

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
