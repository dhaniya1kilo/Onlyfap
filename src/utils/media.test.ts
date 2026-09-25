import { describe, it, expect } from 'vitest';
import { validateMediaFile, validateMediaUrl } from './media';
import { slugify, isSafeHttpUrl } from './format';

describe('validateMediaFile', () => {
  it('accepts allowed types', () => {
    expect(validateMediaFile({ name: 'a.JPG', type: 'image/jpeg', size: 100 }).mediaType).toBe('image');
    expect(validateMediaFile({ name: 'v.webm', type: 'video/webm', size: 100 }).mediaType).toBe('video');
  });
  it('rejects bad types and sizes', () => {
    expect(validateMediaFile({ name: 'a.gif', type: 'image/gif', size: 100 }).ok).toBe(false);
    expect(validateMediaFile({ name: 'a.exe', type: 'image/png', size: 100 }).ok).toBe(false);
    expect(validateMediaFile({ name: 'a.png', type: 'image/png', size: 11 * 1048576 }).ok).toBe(false);
    expect(validateMediaFile({ name: 'a.png', type: 'image/png', size: 0 }).ok).toBe(false);
  });
});

describe('helpers', () => {
  it('slugifies', () => {
    expect(slugify('  Street Food & Chai! ')).toBe('street-food-chai');
  });
  it('checks urls', () => {
    expect(isSafeHttpUrl('https://x.com')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('validateMediaUrl', () => {
  it('guesses media type from a recognised extension', () => {
    const r = validateMediaUrl('https://cdn.example.com/clip.mp4');
    expect(r.ok).toBe(true);
    expect(r.mediaType).toBe('video');
    expect(r.mime).toBe('video/mp4');
  });
  it('ignores the query string when reading the extension', () => {
    const r = validateMediaUrl('https://cdn.example.com/photo.jpg?token=abc&x=1');
    expect(r.mediaType).toBe('image');
  });
  it('is fine with an unrecognised or missing extension, but leaves the type unset', () => {
    const r = validateMediaUrl('https://cdn.example.com/media/abcd1234');
    expect(r.ok).toBe(true);
    expect(r.mediaType).toBeUndefined();
  });
  it('rejects malformed urls and non-http(s) schemes', () => {
    expect(validateMediaUrl('not a url').ok).toBe(false);
    expect(validateMediaUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateMediaUrl('ftp://x.com/a.mp4').ok).toBe(false);
  });
  it('rejects an empty link', () => {
    expect(validateMediaUrl('   ').ok).toBe(false);
  });
});
