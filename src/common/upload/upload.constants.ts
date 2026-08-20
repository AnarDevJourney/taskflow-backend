// ─── Allowed MIME types ─────────────────────────────────────────────
// Single source of truth for what may enter the object store. Anything not
// listed here is rejected with 400 before a single byte reaches MinIO.

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',

  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  'text/plain',
  'text/csv',

  'application/zip',
] as const;

/** Everything accepted as a task attachment. */
export const ALLOWED_MIME_TYPES: readonly string[] = [
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
];

/** Avatars and workspace logos — images only, and no animated GIFs. */
export const ALLOWED_AVATAR_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

// Canonical extension per MIME type. Used when the uploaded filename has no
// usable extension of its own — the key must never inherit an arbitrary
// client-supplied suffix.
export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
};

/** Hard ceiling on how many characters of an original filename we keep. */
export const MAX_ORIGINAL_NAME_LENGTH = 255;
