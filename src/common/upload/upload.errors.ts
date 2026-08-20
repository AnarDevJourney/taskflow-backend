import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

/** 400 — the `file` part was missing from the multipart body. */
export class MissingFileException extends BadRequestException {
  constructor(field = 'file') {
    super(`No file provided in the "${field}" field`);
  }
}

/** 400 — MIME type outside the allow-list. */
export class UnsupportedFileTypeException extends BadRequestException {
  constructor(mimeType: string, allowed: readonly string[]) {
    super(
      `File type not allowed: ${mimeType}. Allowed types: ${allowed.join(', ')}`,
    );
  }
}

/** 400 — upload exceeds the configured size ceiling. */
export class FileTooLargeException extends BadRequestException {
  constructor(maxBytes: number) {
    super(
      `File too large. Maximum upload size is ${Math.round(
        maxBytes / 1024 / 1024,
      )} MB`,
    );
  }
}

/**
 * 400 — the multipart body put the file part before its text fields.
 * Streaming uploads are parsed in wire order: by the time the file part
 * arrives, the fields it depends on must already have been read.
 */
export class MalformedMultipartOrderException extends BadRequestException {
  constructor(missing: string[]) {
    super(
      `Missing form field(s) before the file part: ${missing.join(', ')}. ` +
        'Append all text fields to the FormData before the file field.',
    );
  }
}

/** 500 — MinIO refused or dropped the upload. */
export class StorageUploadFailedException extends InternalServerErrorException {
  constructor() {
    super('Failed to store the uploaded file');
  }
}
