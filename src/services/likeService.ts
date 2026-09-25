import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { FEATURES } from '../lib/site';

/**
 * Likes ("hearts").
 * - Stored in `content_likes` (one row per user per item; primary key
 *   prevents duplicates). `content.like_count` is maintained by a trigger.
 * - A like needs a session: a real account, or — if VITE_ENABLE_ANONYMOUS_LIKES
 *   is 'true' and Anonymous sign-ins are enabled in Supabase — an anonymous
 *   Supabase session that holds no personal data.
 * - Liked state for visible items is fetched in small batches, only for the
 *   current user, and only for ids on screen.
 */

interface Entry {
  liked: boolean | null; // null = unknown yet
  count: number | null; // null = use the count that came with the item
  pending: boolean;
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
let userId: string | null = null;
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function patch(id: string, p: Partial<Entry>) {
  const e = entries.get(id) ?? { liked: null, count: null, pending: false };
  entries.set(id, { ...e, ...p });
}

/** Called by AuthProvider whenever the signed-in user changes. */
export function setLikeUser(uid: string | null) {
  if (uid === userId) return;
  userId = uid;
  entries.clear();
  queue.clear();
  emit();
}

async function flush() {
  timer = null;
  const ids = [...queue];
  queue = new Set();
  const uid = userId;
  if (!uid || ids.length === 0) return;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase.from('content_likes').select('content_id').eq('user_id', uid).in('content_id', chunk);
    if (uid !== userId) return; // user changed meanwhile
    if (error) continue;
    const liked = new Set((data ?? []).map((r) => (r as { content_id: string }).content_id));
    chunk.forEach((id) => {
      if (entries.get(id)?.pending) return;
      patch(id, { liked: liked.has(id) });
    });
  }
  emit();
}

function requestState(id: string) {
  if (!userId) return;
  const e = entries.get(id);
  if (e && e.liked !== null) return;
  queue.add(id);
  timer ??= setTimeout(() => void flush(), 60);
}

export class NeedLoginError extends Error {
  constructor() {
    super('Log in to like posts.');
    this.name = 'NeedLoginError';
  }
}

async function ensureSession(): Promise<string> {
  if (userId) return userId;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    setLikeUser(data.session.user.id);
    return data.session.user.id;
  }
  if (!FEATURES.anonymousLikes) throw new NeedLoginError();
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new NeedLoginError();
  setLikeUser(anon.user.id);
  return anon.user.id;
}

export async function toggleLike(id: string, fallbackCount: number): Promise<void> {
  await ensureSession();
  const before = entries.get(id) ?? { liked: null, count: null, pending: false };
  if (before.pending) return;
  const wasLiked = before.liked === true;
  const baseCount = before.count ?? fallbackCount;
  patch(id, { liked: !wasLiked, count: Math.max(0, baseCount + (wasLiked ? -1 : 1)), pending: true });
  emit();
  try {
    const { data, error } = await supabase.rpc('toggle_like', { p_content_id: id });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { liked: boolean; like_count: number } | null;
    if (row) patch(id, { liked: row.liked, count: Number(row.like_count), pending: false });
    else patch(id, { pending: false });
  } catch (e) {
    patch(id, { liked: before.liked, count: before.count, pending: false });
    throw e;
  } finally {
    emit();
  }
}

/** Liked state + count for one item, kept in sync across every place it is shown. */
export function useLike(id: string, initialCount: number) {
  useSyncExternalStore(subscribe, () => version, () => version);
  const uid = userId; // re-request after login/logout
  useEffect(() => {
    requestState(id);
  }, [id, uid]);
  const e = entries.get(id);
  const toggle = useCallback(() => toggleLike(id, initialCount), [id, initialCount]);
  return {
    liked: e?.liked === true,
    count: e?.count ?? initialCount,
    pending: e?.pending ?? false,
    toggle,
  };
}
