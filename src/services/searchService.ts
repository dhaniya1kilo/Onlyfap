import { supabase } from '../lib/supabase';
import type { SearchSuggestion } from '../types';

/**
 * Suggestions come from real data via search_suggestions():
 * popular searches (only queries searched by several visitors), popular
 * tags, and matching titles. Results are cached briefly per prefix.
 */
const cache = new Map<string, { at: number; value: SearchSuggestion[] }>();
const TTL = 60_000;

export async function fetchSuggestions(prefix: string, limit = 8): Promise<SearchSuggestion[]> {
  const key = `${prefix.trim().toLowerCase()}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const { data, error } = await supabase.rpc('search_suggestions', { p_prefix: prefix.slice(0, 80), p_limit: limit });
  if (error) throw error;
  const value = ((data ?? []) as SearchSuggestion[]).map((s) => ({ ...s, weight: Number(s.weight) }));
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 100) cache.delete(cache.keys().next().value as string);
  return value;
}

/**
 * Record a search for "popular searches". Only the normalised query text and
 * a result count are stored (no user, IP or session); each query is logged
 * at most once per browser tab session. Emails/URLs/long numbers are
 * discarded server-side.
 */
export function logSearch(query: string, resultCount: number | null) {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (q.length < 2 || q.length > 80) return;
  const key = `onlyfap:searched:${q}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
  // supabase-js builders are lazy: .then() is what actually sends the request.
  supabase.rpc('log_search', { p_query: q, p_result_count: resultCount }).then(
    () => undefined,
    () => undefined,
  );
}
