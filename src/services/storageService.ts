import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_BUCKET } from '../lib/supabase';
import { EXTERNAL_PATH_PREFIX } from '../utils/media';

/**
 * Upload with real progress events. supabase-js has no progress callback,
 * so this calls the Storage REST endpoint with the user's own access token
 * (never a service key). Storage RLS still decides whether it is allowed.
 */
export async function uploadMedia(
  file: File,
  path: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<{ path: string; publicUrl: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session expired. Log in again.');

  const endpoint = `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', '3600');
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      const err = Object.assign(new Error(xhr.status === 413 ? 'payload too large' : 'upload failed'), { status: xhr.status });
      if (xhr.status === 403 || xhr.status === 401) Object.assign(err, { code: '42501' });
      reject(err);
    };
    xhr.onerror = () => reject(new Error('network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });

  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { path, publicUrl: pub.publicUrl };
}

/** Best-effort removal; logs instead of throwing so callers can continue. */
export async function removeMedia(path: string | null | undefined): Promise<boolean> {
  if (!path || path.startsWith(EXTERNAL_PATH_PREFIX)) return true; // linked media: never stored here
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) {
    console.warn('OnlyFap: storage cleanup failed for', path);
    return false;
  }
  return true;
}
