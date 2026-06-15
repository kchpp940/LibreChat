import { FilePurpose, FileVisibility, IndexingStatus } from './types';
import type { TFile, FileDisplayMetadata, UnifiedFileLike } from './types';
import { normalizeFileMetadata, embeddedFromIndexingStatus } from './normalize';
import { getFilePurpose, getIndexingStatus, getFileVisibility } from './predicates';

export type SerializeFileOptions = {
  stripText?: boolean;
  stripInternal?: boolean;
};

export function serializeFileMetadata<T extends UnifiedFileLike>(
  file: T,
  options: SerializeFileOptions = {},
): T & {
  purpose: FilePurpose;
  indexingStatus: IndexingStatus;
  visibility: FileVisibility;
  display: FileDisplayMetadata;
  embedded: boolean;
} {
  const normalized = normalizeFileMetadata({ ...file } as Partial<TFile>) as unknown as T & Partial<TFile>;

  const display: FileDisplayMetadata = { ...(normalized.display ?? {}) };

  if (options.stripText === true) {
    delete display.text;
  }

  const purpose = normalized.purpose ?? getFilePurpose(normalized);
  const indexingStatus = normalized.indexingStatus ?? getIndexingStatus(normalized);
  const visibility = normalized.visibility ?? getFileVisibility(normalized);
  const embedded = embeddedFromIndexingStatus(indexingStatus);

  const out = {
    ...normalized,
    purpose,
    indexingStatus,
    visibility,
    display,
    embedded,
  } as T & {
    purpose: FilePurpose;
    indexingStatus: IndexingStatus;
    visibility: FileVisibility;
    display: FileDisplayMetadata;
    embedded: boolean;
  };

  if (options.stripInternal === true) {
    delete (out as Record<string, unknown>)._id;
    delete (out as Record<string, unknown>).__v;
    delete (out as Record<string, unknown>).text;
    delete (out as Record<string, unknown>).width;
    delete (out as Record<string, unknown>).height;
    delete (out as Record<string, unknown>).textFormat;
  }

  return out;
}
