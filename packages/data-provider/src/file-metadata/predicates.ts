import { imageExtRegex, audioMimeTypes, videoMimeTypes } from '../file-config';
import { FilePurpose, FileVisibility, IndexingStatus } from './types';
import type { UnifiedFileLike, TFile } from './types';
import { normalizeFileMetadata } from './normalize';

export function isIndexed(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return normalized.indexingStatus === IndexingStatus.completed;
}

export function isImageFile(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  const filename = normalized.filename ?? '';
  const type = normalized.type ?? '';
  if (type.startsWith('image/')) {
    return true;
  }
  return imageExtRegex.test(filename);
}

export function isTextFile(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  const type = normalized.type ?? '';
  return type.startsWith('text/') || type === 'application/json';
}

export function isPdfFile(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return normalized.type === 'application/pdf';
}

export function isVideoFile(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return typeof normalized.type === 'string' && videoMimeTypes.test(normalized.type);
}

export function isAudioFile(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return typeof normalized.type === 'string' && audioMimeTypes.test(normalized.type);
}

export function isCodeEnvFile(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return !!(normalized.metadata?.codeEnvRef ?? normalized.metadata?.fileIdentifier);
}

export function hasDisplayDimensions(file: UnifiedFileLike): boolean {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  const display = normalized.display ?? {};
  return display.width != null && display.height != null;
}

export function getDisplayWidth(file: UnifiedFileLike): number | undefined {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return normalized.display?.width;
}

export function getDisplayHeight(file: UnifiedFileLike): number | undefined {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return normalized.display?.height;
}

export function getDisplayText(file: UnifiedFileLike): string | undefined {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return normalized.display?.text;
}

export function getDisplayTextFormat(file: UnifiedFileLike): 'html' | 'text' | null | undefined {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  return normalized.display?.textFormat;
}

export function getFilePurpose(file: UnifiedFileLike): FilePurpose {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  if (normalized.purpose !== undefined) {
    return normalized.purpose;
  }
  return FilePurpose.unknown;
}

export function getIndexingStatus(file: UnifiedFileLike): IndexingStatus {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  if (normalized.indexingStatus !== undefined) {
    return normalized.indexingStatus;
  }
  return IndexingStatus.not_required;
}

export function getFileVisibility(file: UnifiedFileLike): FileVisibility {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>);
  if (normalized.visibility !== undefined) {
    return normalized.visibility;
  }
  return FileVisibility.private;
}
