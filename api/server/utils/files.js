const sharp = require('sharp');

/**
 * Determines the file type of a buffer
 * @param {Buffer} dataBuffer
 * @param {boolean} [returnFileType=false] - Optional. If true, returns the file type instead of the file extension.
 * @returns {Promise<string|null|import('file-type').FileTypeResult>} - Returns the file extension if found, else null
 * */
const determineFileType = async (dataBuffer, returnFileType) => {
  const fileType = await import('file-type');
  const type = await fileType.fileTypeFromBuffer(dataBuffer);
  if (returnFileType) {
    return type;
  }
  return type ? type.ext : null; // Returns extension if found, else null
};

/**
 * Get buffer metadata
 * @param {Buffer} buffer
 * @returns {Promise<{ bytes: number, type: string, dimensions: Record<string, number>, extension: string}>}
 */
const getBufferMetadata = async (buffer) => {
  const fileType = await determineFileType(buffer, true);
  const bytes = buffer.length;
  let extension = fileType ? fileType.ext : 'unknown';

  /** @type {Record<string, number>} */
  let dimensions = {};

  if (fileType && fileType.mime.startsWith('image/') && extension !== 'unknown') {
    const imageMetadata = await sharp(buffer).metadata();
    dimensions = {
      width: imageMetadata.width,
      height: imageMetadata.height,
    };
  }

  return {
    bytes,
    type: fileType?.mime ?? 'unknown',
    dimensions,
    extension,
  };
};

/**
 * Removes UUID prefix from filename for clean display
 * Pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx__filename.ext
 * @param {string} fileName - The filename to clean
 * @returns {string} - The cleaned filename without UUID prefix
 */
const cleanFileName = (fileName) => {
  if (!fileName) {
    return fileName;
  }

  // Remove UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx__
  const cleaned = fileName.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}__/i,
    '',
  );

  return cleaned;
};

const encodeRFC5987ValueChars = (value) =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const getAsciiFilenameFallback = (fileName) => {
  const fallback = fileName
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\\r\n]/g, '_');

  return fallback || 'download';
};

const getContentDisposition = (fileName, disposition = 'attachment') => {
  const cleanedFilename = cleanFileName(fileName) || 'download';
  const asciiFallback = getAsciiFilenameFallback(cleanedFilename);
  const encodedFilename = encodeRFC5987ValueChars(cleanedFilename);

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
};

/**
 * Allowlist of fields on the public file asset descriptor.
 *
 * These are the only fields that may be sent to the client for display purposes.
 * Never add internal fields like `storageKey`, `storageRegion`, `source`,
 * `filepath`, `preview`, `metadata`, `user`, `tenantId`, `_id`, `__v`, `object`,
 * or `usage` to this list — they are internal implementation details.
 *
 * `text` and `textFormat` are included specifically for inline attachment
 * previews (code interpreter output, tool artifacts). They are attachment
 * content, not file metadata, and should only be populated on message
 * attachment payloads — not on file list / file detail responses.
 */
const PUBLIC_DESCRIPTOR_FIELDS = [
  'file_id',
  'filename',
  'type',
  'bytes',
  'url',
  'thumbnailUrl',
  'width',
  'height',
  'context',
  'embedded',
  'filterSource',
  'expiresAt',
  'status',
  'previewError',
  'text',
  'textFormat',
  'createdAt',
  'updatedAt',
  'conversationId',
];

/**
 * Serialize an internal TFile / IMongoFile record into a public
 * `PublicFileAssetDescriptor` suitable for client-side display.
 *
 * - Strips all internal fields (storage keys, user IDs, raw metadata, etc.)
 * - Computes `url` from the raw record's `preview` or `filepath` via the
 *   download URL route — never exposes raw storage paths
 * - Sets `thumbnailUrl` when the file has an image preview
 * - Maps `source` → `filterSource` (display-only storage origin label)
 *
 * @param {object} file - Internal file record (TFile / IMongoFile)
 * @param {string} [baseUrl] - Optional base URL for download endpoint
 * @returns {import('librechat-data-provider').PublicFileAssetDescriptor}
 */
const toPublicFileDescriptor = (file, baseUrl) => {
  const raw = typeof file.toObject === 'function' ? file.toObject() : file;
  const descriptor = {};

  for (const field of PUBLIC_DESCRIPTOR_FIELDS) {
    if (raw[field] !== undefined) {
      descriptor[field] = raw[field];
    }
  }

  if (!descriptor.url) {
    if (raw.preview) {
      descriptor.url = raw.preview;
    } else if (raw.filepath) {
      descriptor.url = raw.filepath.startsWith('http')
        ? raw.filepath
        : `${baseUrl}/api/files/download/${raw.user}/${raw.file_id}`;
    }
  }

  if (!descriptor.thumbnailUrl && raw.preview) {
    descriptor.thumbnailUrl = raw.preview;
  }

  if (!descriptor.file_id && raw.file_id) {
    descriptor.file_id = raw.file_id;
  }
  if (!descriptor.filename && raw.filename) {
    descriptor.filename = raw.filename;
  }
  if (!descriptor.type && raw.type) {
    descriptor.type = raw.type;
  }
  if (descriptor.bytes === undefined && raw.bytes !== undefined) {
    descriptor.bytes = raw.bytes;
  }
  if (descriptor.embedded === undefined && raw.embedded !== undefined) {
    descriptor.embedded = raw.embedded;
  }

  return descriptor;
};

module.exports = {
  determineFileType,
  getBufferMetadata,
  cleanFileName,
  getContentDisposition,
  toPublicFileDescriptor,
  PUBLIC_DESCRIPTOR_FIELDS,
};
