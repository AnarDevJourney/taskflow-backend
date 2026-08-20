import { randomUUID } from 'crypto';
import { extname } from 'path';
import { EXTENSION_BY_MIME } from './upload.constants';

/**
 * Object key layout:
 *
 *   <segment>/<segment>/…/YYYY-MM-DD/<unixSeconds>_<uuid>.<ext>
 *   ws1/proj9/task44/2026-08-20/1724155512_f81d4fae-…-9d2b.pdf
 *
 * The date folder keeps prefix listings shallow enough to stay fast as the
 * bucket grows, and timestamp + uuid make the key collision-free without ever
 * trusting the client-supplied filename (which only survives in metadata).
 */
export function buildObjectKey(
  segments: string[],
  originalName: string,
  mimeType: string,
): string {
  const datePart = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const timestamp = Math.floor(Date.now() / 1000);
  const ext = resolveExtension(originalName, mimeType);

  const prefix = segments.map(sanitizeSegment).filter(Boolean).join('/');
  const filename = `${timestamp}_${randomUUID()}${ext ? `.${ext}` : ''}`;

  return `${prefix}/${datePart}/${filename}`;
}

// Prefer the uploaded file's own extension when it is plainly safe, otherwise
// fall back to the canonical one for its MIME type.
function resolveExtension(originalName: string, mimeType: string): string {
  const raw = extname(originalName).slice(1).toLowerCase();
  if (/^[a-z0-9]{1,10}$/.test(raw)) return raw;
  return EXTENSION_BY_MIME[mimeType] ?? '';
}

// Path segments come from ObjectIds and user ids, but never assume it —
// anything that could break out of the prefix is stripped.
function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '');
}
