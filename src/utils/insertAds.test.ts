import { describe, it, expect } from 'vitest';
import { insertAdsIntoFeed } from './insertAds';
import type { Ad } from '../types';

const ad = (id: string, active = true): Ad => ({
  id, admin_id: 'a', ad_type: 'link', label: null, ad_content: 'https://example.com',
  is_active: active, created_at: '', updated_at: '',
});
const items = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(from + i) }));

const shape = (entries: ReturnType<typeof insertAdsIntoFeed>) =>
  entries.map((e) => (e.kind === 'ad' ? 'AD' : (e.item as { id: string }).id));

describe('insertAdsIntoFeed', () => {
  it('puts an ad after every 5 content items', () => {
    expect(shape(insertAdsIntoFeed(items(1, 12), [ad('x')]))).toEqual(
      ['1', '2', '3', '4', '5', 'AD', '6', '7', '8', '9', '10', 'AD', '11', '12'],
    );
  });

  it('keeps a global counter across pagination batches', () => {
    const page1 = items(1, 10);
    const page2 = items(11, 20);
    const all = insertAdsIntoFeed([...page1, ...page2], [ad('x'), ad('y')]);
    const adPositions = all.flatMap((e, i) => (e.kind === 'ad' ? [i] : []));
    const precedingContent = adPositions.map((p) => (all[p - 1] as { item: { id: string } }).item.id);
    expect(precedingContent).toEqual(['5', '10', '15', '20']);
    const slots = all.filter((e) => e.kind === 'ad').map((e) => (e as { slot: number }).slot);
    expect(slots).toEqual([0, 1, 2, 3]);
  });

  it('adding a page does not change earlier ad keys', () => {
    const before = insertAdsIntoFeed(items(1, 10), [ad('x')]).map((e) => e.key);
    const after = insertAdsIntoFeed(items(1, 20), [ad('x')]).map((e) => e.key);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('returns plain content when there are no usable ads', () => {
    expect(shape(insertAdsIntoFeed(items(1, 7), []))).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(shape(insertAdsIntoFeed(items(1, 7), [ad('off', false)]))).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('rotates ads', () => {
    const ids = insertAdsIntoFeed(items(1, 15), [ad('x'), ad('y')])
      .filter((e) => e.kind === 'ad').map((e) => (e as { ad: Ad }).ad.id);
    expect(ids).toEqual(['x', 'y', 'x']);
  });
});
