import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flame, Clapperboard, TrendingUp } from 'lucide-react';
import type { BrowseSort, MediaType } from '../types';
import { BROWSE_SORTS, browseSortFromParam, browseSortParam } from '../lib/labels';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useSeo } from '../hooks/useSeo';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { useActiveAds } from '../hooks/useActiveAds';
import { usePopular } from '../hooks/usePopularTags';
import { browseContent } from '../services/contentService';
import { insertAdsIntoFeed } from '../utils/insertAds';
import { DiscoveryFeed } from '../components/feed/DiscoveryFeed';
import { ContentResultCard } from '../components/feed/ContentResultCard';
import { AdSlot } from '../components/feed/AdSlot';
import { ListFooter } from '../components/ui/ListFooter';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/States';
import { MEDIA_FILTERS, Segmented } from '../components/ui/Segmented';
import { SITE } from '../lib/site';

const DESCRIPTIONS: Record<BrowseSort, string> = {
  trending: 'What people are watching right now: ranked by recent views and likes, not just lifetime totals.',
  most_viewed: 'The most viewed videos and photos of all time.',
  new: 'The newest uploads, latest first.',
  old: 'Older uploads, earliest first.',
};

/** Home = Trending discovery. Phones get the full-screen vertical feed; larger screens get a grid. */
export default function HomePage() {
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const sort = browseSortFromParam(params.get('sort'));
  const typeParam = params.get('type');
  const mediaType: MediaType | 'all' = typeParam === 'image' || typeParam === 'video' ? typeParam : 'all';
  const sortLabel = BROWSE_SORTS.find((s) => s.value === sort)?.label ?? 'Trending';

  useSeo({
    title: sort === 'trending' ? undefined : `${sortLabel} videos`,
    description: sort === 'trending' ? SITE.description : DESCRIPTIONS[sort],
    canonical: sort === 'trending' ? '/' : `/?sort=${browseSortParam(sort)}`,
    jsonLd: sort === 'trending'
      ? {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE.name,
          url: SITE.origin,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${SITE.origin}/search?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }
      : null,
  });

  const setSort = useCallback(
    (s: BrowseSort) => {
      const next = new URLSearchParams(params);
      if (s === 'trending') next.delete('sort');
      else next.set('sort', browseSortParam(s));
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setType = (t: MediaType | 'all') => {
    const next = new URLSearchParams(params);
    if (t === 'all') next.delete('type'); else next.set('type', t);
    setParams(next, { replace: true });
  };

  if (isMobile) return <DiscoveryFeed sort={sort} onSort={setSort} mediaType={mediaType} />;

  return <DesktopHome sort={sort} sortLabel={sortLabel} setSort={setSort} mediaType={mediaType} setType={setType} />;
}

function DesktopHome({
  sort,
  sortLabel,
  setSort,
  mediaType,
  setType,
}: {
  sort: BrowseSort;
  sortLabel: string;
  setSort: (s: BrowseSort) => void;
  mediaType: MediaType | 'all';
  setType: (t: MediaType | 'all') => void;
}) {
  const fetchPage = useCallback(
    (offset: number, limit: number) => browseContent({ sort, mediaType }, offset, limit),
    [sort, mediaType],
  );
  const list = useInfiniteList(fetchPage, `home|${sort}|${mediaType}`, 20);
  const ads = useActiveAds();
  const entries = useMemo(() => insertAdsIntoFeed(list.items, ads), [list.items, ads]);
  const popular = usePopular(14);
  const feedLink = `/feed${sort === 'trending' ? '' : `?sort=${browseSortParam(sort)}`}`;

  return (
    <div className="space-y-6">
      <section aria-labelledby="home-h" className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-flame-soft">
            {sort === 'trending' ? <Flame className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
            Discover
          </p>
          <h1 id="home-h" className="text-3xl font-extrabold sm:text-4xl">{sort === 'trending' ? 'Trending now' : sortLabel}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{DESCRIPTIONS[sort]}</p>
        </div>
        <Link to={feedLink} className="btn-primary">
          <Clapperboard className="h-4 w-4" aria-hidden="true" /> Watch in vertical feed
        </Link>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Sort" className="flex flex-wrap gap-2">
          {BROWSE_SORTS.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={sort === s.value}
              onClick={() => setSort(s.value)}
              className={`pill ${sort === s.value ? 'pill-on' : 'pill-off'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Segmented label="Media type" options={MEDIA_FILTERS} value={mediaType} onChange={setType} size="sm" />
      </div>

      {popular.tags.length > 0 && (
        <nav aria-label="Popular tags" className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {popular.tags.map((t) => (
              <li key={t.value}>
                <Link to={`/search?tag=${encodeURIComponent(t.value)}`} className="tag-chip px-3 py-1 text-[13px]">#{t.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {!list.initialized && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {list.initialized && list.error && list.items.length === 0 && <ErrorState message={list.error} onRetry={list.loadMore} />}
      {list.initialized && !list.error && list.items.length === 0 && (
        <EmptyState title="Nothing posted yet">New videos and photos will appear here as soon as they're published.</EmptyState>
      )}

      {list.items.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((e, i) =>
            e.kind === 'ad'
              ? <AdSlot key={e.key} ad={e.ad} className="self-start" />
              : <ContentResultCard key={e.key} item={e.item} priority={i < 4} />,
          )}
        </div>
      )}
      {list.initialized && list.items.length > 0 && (
        <ListFooter loading={list.loading} error={list.error} hasMore={list.hasMore} count={list.items.length} onMore={list.loadMore} />
      )}
    </div>
  );
}
