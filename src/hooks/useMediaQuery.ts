import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Phones (and small tablets in portrait) get the vertical full-screen feed. */
export const MOBILE_QUERY = '(max-width: 767px)';
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
