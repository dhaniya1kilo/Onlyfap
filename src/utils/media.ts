import type { MediaType } from '../types';

export const ALLOWED_MIME: Record<string, MediaType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
};

const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm',
};
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'];
const MIME_FOR_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm',
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB (matches bucket limit)

export const ACCEPT_ATTR = Object.keys(ALLOWED_MIME).join(',');

export interface FileCheck {
  ok: boolean;
  error?: string;
  mediaType?: MediaType;
}

export function validateMediaFile(file: { name: string; type: string; size: number }): FileCheck {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mediaType = ALLOWED_MIME[file.type];
  if (!mediaType || !ALLOWED_EXT.includes(ext)) {
    return { ok: false, error: 'Use a JPG, PNG, WEBP, MP4 or WEBM file.' };
  }
  const max = mediaType === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) {
    return { ok: false, error: `This ${mediaType} is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${max / 1048576} MB.` };
  }
  if (file.size === 0) return { ok: false, error: 'This file is empty.' };
  return { ok: true, mediaType };
}

/** Sniff magic bytes so a renamed file cannot pass as media. */
export async function sniffMime(file: Blob): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp') return 'video/mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}

export function storagePathFor(userId: string, mime: string): string {
  const ext = EXT_FOR_MIME[mime] ?? 'bin';
  const d = new Date();
  const ym = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${userId}/${ym}/${crypto.randomUUID()}.${ext}`;
}

// ---------------------------------------------------------------------------
// Link-based media (paste a URL instead of uploading a file)
// ---------------------------------------------------------------------------

/** `media_path` prefix used for linked (not uploaded) media — see storageService.removeMedia. */
export const EXTERNAL_PATH_PREFIX = 'external/';

/** A `media_path` placeholder for linked media: nothing to store, nothing to clean up. */
export function externalMediaPath(): string {
  return `${EXTERNAL_PATH_PREFIX}${crypto.randomUUID()}`;
}

export const MAX_MEDIA_URL_LENGTH = 2000;

export interface UrlCheck {
  ok: boolean;
  error?: string;
  /** Media type guessed from the URL's file extension, if any. Absent when the admin must pick it manually. */
  mediaType?: MediaType;
  mime?: string;
}

/**
 * Validates a pasted media link. Only checks that it's a well-formed http(s)
 * URL — it does not fetch the URL (many hosts block cross-origin requests),
 * so it cannot confirm the link actually serves playable media. It guesses
 * the media type from the file extension when one is present.
 */
export function validateMediaUrl(value: string): UrlCheck {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: 'Paste a link to the file.' };
  if (trimmed.length > MAX_MEDIA_URL_LENGTH) return { ok: false, error: 'That link is too long.' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Use an http:// or https:// link.' };
  }
  const ext = url.pathname.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_FOR_EXT[ext];
  if (!mime) return { ok: true }; // unrecognised/no extension: let the admin pick the type
  return { ok: true, mediaType: ALLOWED_MIME[mime], mime };
}
