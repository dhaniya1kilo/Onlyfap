import type { Ad } from '../types';

export const AD_INTERVAL = 5;

export type FeedEntry<T> =
  | { kind: 'content'; key: string; item: T; index: number }
  | { kind: 'ad'; key: string; ad: Ad; slot: number };

/**
 * Interleave ads into a list of content items: one ad after every
 * `interval` CONTENT items. It is always called with the FULL accumulated
 * list (all pages loaded so far), so the counter is global across
 * pagination by construction: item #5, #10, #15, #20 ... are followed by
 * ad slots 0, 1, 2, 3 ... regardless of which batch they arrived in.
 *
 * Ads rotate through `ads`. If `ads` is empty, content is returned alone
 * (no blank placeholders).
 */
export function insertAdsIntoFeed<T extends { id: string }>(
  items: T[],
  ads: Ad[],
  interval: number = AD_INTERVAL,
): FeedEntry<T>[] {
  const out: FeedEntry<T>[] = [];
  const usable = ads.filter((a) => a.is_active && a.ad_content.trim().length > 0);
  items.forEach((item, index) => {
    out.push({ kind: 'content', key: `c-${item.id}`, item, index });
    const count = index + 1;
    if (usable.length > 0 && interval > 0 && count % interval === 0) {
      const slot = count / interval - 1;
      const ad = usable[slot % usable.length];
      out.push({ kind: 'ad', key: `ad-slot-${slot}`, ad, slot });
    }
  });
  return out;
}
