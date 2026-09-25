import { useEffect, useRef } from 'react';
import { recordView } from '../services/contentService';

/** How long an item must be actively on screen before it counts as a view. */
export const VIEW_THRESHOLD_MS = 2000;

/**
 * Records a view once `active` has stayed true for VIEW_THRESHOLD_MS.
 * Never fires on render alone; scrolling past quickly does not count.
 * Duplicates are prevented here (per tab), in sessionStorage, and in the
 * database (one view per viewer per item per day).
 */
export function useViewTracker(id: string | null | undefined, active: boolean, onCounted?: () => void) {
  const done = useRef<string | null>(null);
  const cb = useRef(onCounted);
  cb.current = onCounted;

  useEffect(() => {
    if (!id || !active || done.current === id) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const t = setTimeout(() => {
      done.current = id;
      recordView(id)
        .then((counted) => counted && cb.current?.())
        .catch(() => undefined);
    }, VIEW_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, [id, active]);
}
