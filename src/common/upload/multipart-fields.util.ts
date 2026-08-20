import { BadRequestException, Type } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { basename } from 'path';
import { MalformedMultipartOrderException } from './upload.errors';
import { MAX_ORIGINAL_NAME_LENGTH } from './upload.constants';

/**
 * Validates the text fields of a multipart body while the file part is still
 * unread. The global ValidationPipe cannot help here — it only runs once the
 * whole request has been parsed, which is far too late to stop bytes from
 * reaching object storage.
 */
export function validateMultipartFields<T extends object>(
  body: unknown,
  dtoType: Type<T>,
  requiredFields: (keyof T & string)[],
): T {
  const raw = (body ?? {}) as Record<string, unknown>;

  const missing = requiredFields.filter(
    (field) => raw[field] === undefined || raw[field] === '',
  );
  if (missing.length) throw new MalformedMultipartOrderException(missing);

  const dto = plainToInstance(dtoType, raw, { enableImplicitConversion: true });

  const errors = validateSync(dto as object, { whitelist: true });

  if (errors.length) {
    throw new BadRequestException(
      errors.flatMap((e) => Object.values(e.constraints ?? {})),
    );
  }

  return dto;
}

/**
 * Turns a client-supplied filename into something safe to store and render:
 * no directory components, no control characters, bounded length.
 */
export function sanitizeFilename(originalName: string): string {
  const name = basename(originalName ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f/\\]/g, '')
    .trim();

  return (name.length ? name : 'file').slice(0, MAX_ORIGINAL_NAME_LENGTH);
}
