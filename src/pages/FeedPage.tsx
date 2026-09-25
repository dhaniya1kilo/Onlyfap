import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BrowseSort } from '../types';
import { browseSortFromParam, browseSortParam } from '../lib/labels';
import { DiscoveryFeed } from '../components/feed/DiscoveryFeed';
import { useSeo } from '../hooks/useSeo';

/** /feed — the vertical full-screen feed on any screen size (desktop "immersive mode"). */
export default function FeedPage() {
  const [params, setParams] = useSearchParams();
  const sort = browseSortFromParam(params.get('sort'));
  const tag = params.get('tag') ?? undefined;
  useSeo({ title: 'Vertical feed', canonical: '/', noindex: true });

  const setSort = useCallback(
    (s: BrowseSort) => {
      const next = new URLSearchParams(params);
      if (s === 'trending') next.delete('sort'); else next.set('sort', browseSortParam(s));
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return (
    <div className="h-full w-full bg-black">
      {/* On wide screens keep a phone-like 9:16 column so the overlays stay readable. */}
      <div className="mx-auto h-full w-full md:max-w-[min(100%,calc((100dvh-4rem)*0.6))]">
        <DiscoveryFeed sort={sort} onSort={setSort} tag={tag} />
      </div>
    </div>
  );
}
