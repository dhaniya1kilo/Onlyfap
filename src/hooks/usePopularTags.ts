import { useEffect, useState } from 'react';
import type { SearchSuggestion } from '../types';
import { fetchSuggestions } from '../services/searchService';

/** Popular tags + popular searches from the database (empty-prefix suggestions). */
export function usePopular(limit = 12) {
  const [data, setData] = useState<SearchSuggestion[]>([]);
  useEffect(() => {
    let live = true;
    fetchSuggestions('', limit).then((d) => live && setData(d)).catch(() => live && setData([]));
    return () => { live = false; };
  }, [limit]);
  return {
    tags: data.filter((s) => s.kind === 'tag'),
    searches: data.filter((s) => s.kind === 'query'),
  };
}
