import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '../types';
import { friendlyError } from '../lib/errors';

/**
 * Batched loading with duplicate-request prevention, stale-response
 * protection (when `resetKey` changes) and id de-duplication.
 */
export function useInfiniteList<T extends { id: string }>(
  fetchPage: (offset: number, limit: number) => Promise<Page<T>>,
  resetKey: string,
  pageSize = 10,
  enabled = true,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [nonce, setNonce] = useState(0);

  const inFlight = useRef(false);
  const offset = useRef(0);
  const generation = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const loadMore = useCallback(async () => {
    if (inFlight.current || !enabled) return;
    inFlight.current = true;
    const gen = generation.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchRef.current(offset.current, pageSize);
      if (gen !== generation.current) return; // query changed meanwhile
      offset.current += page.items.length;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setHasMore(page.hasMore && page.items.length > 0);
    } catch (e) {
      if (gen === generation.current) setError(friendlyError(e, 'Could not load more. Retry.'));
    } finally {
      if (gen === generation.current) {
        inFlight.current = false;
        setLoading(false);
        setInitialized(true);
      }
    }
  }, [enabled, pageSize]);

  // Reset whenever the query identity changes.
  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    offset.current = 0;
    setItems([]);
    setHasMore(true);
    setError(null);
    setInitialized(false);
    if (enabled) void loadMore();
  }, [resetKey, enabled, loadMore, nonce]);

  const removeLocal = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const updateLocal = useCallback(
    (id: string, patch: Partial<T>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    [],
  );
  /** Start again from the first page (e.g. after an admin action). */
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { items, loading, error, hasMore, initialized, loadMore, removeLocal, updateLocal, reload };
}
