import { useEffect, useState } from 'react';
import type { Ad } from '../types';
import { fetchActiveAds } from '../services/adService';
import { isRenderableAd } from '../components/feed/AdSlot';

let cache: Promise<Ad[]> | null = null;

/** Active ads, fetched once per page load. Failure = no ads, never a broken feed. */
export function useActiveAds(): Ad[] {
  const [ads, setAds] = useState<Ad[]>([]);
  useEffect(() => {
    let live = true;
    cache ??= fetchActiveAds().catch(() => {
      cache = null;
      return [];
    });
    cache.then((a) => live && setAds(a.filter(isRenderableAd)));
    return () => { live = false; };
  }, []);
  return ads;
}
