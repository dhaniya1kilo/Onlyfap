import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { MediaType, SearchSort, Tag } from '../types';
import { searchContent, searchCount } from '../services/contentService';
import { fetchTagBySlug } from '../services/tagService';
import { logSearch } from '../services/searchService';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { useActiveAds } from '../hooks/useActiveAds';
import { useSeo } from '../hooks/useSeo';
import { usePopular } from '../hooks/usePopularTags';
import { useIsMobile } from '../hooks/useMediaQuery';
import { insertAdsIntoFeed } from '../utils/insertAds';
import { SEARCH_SORTS, searchSortFromParam } from '../lib/labels';
import { ContentResultCard } from '../components/feed/ContentResultCard';
import { AdSlot } from '../components/feed/AdSlot';
import { CategoryBar } from '../components/layout/CategoryBar';
import { SearchBar } from '../components/layout/SearchBar';
import { ListFooter } from '../components/ui/ListFooter';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/States';
import { MEDIA_FILTERS, Segmented } from '../components/ui/Segmented';

const PAGE_SIZE = 20;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const q = (params.get('q') ?? '').trim();
  const tagSlug = (params.get('tag') ?? '').trim();
  const typeParam = params.get('type');
  const mediaType: MediaType | 'all' = typeParam === 'image' || typeParam === 'video' ? typeParam : 'all';
  // Without a text query, "relevance" has no meaning → default to most viewed.
  const sort: SearchSort = params.get('sort') ? searchSortFromParam(params.get('sort')) : q ? 'relevance' : 'most_viewed';
  const [tag, setTag] = useState<Tag | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const popular = usePopular(10);

  useSeo({
    title: q ? `Search: ${q}` : tag ? `#${tag.name} videos` : 'Browse',
    description: tag ? `Browse ${tag.name} videos and photos on OnlyFap.` : undefined,
    canonical: tagSlug && !q ? `/search?tag=${encodeURIComponent(tagSlug)}` : '/search',
    noindex: Boolean(q), // search result pages are not indexed; tag pages are
  });

  useEffect(() => {
    let live = true;
    setTag(null);
    if (tagSlug) fetchTagBySlug(tagSlug).then((t) => live && setTag(t)).catch(() => undefined);
    return () => { live = false; };
  }, [tagSlug]);

  const key = `${q}|${tagSlug}|${mediaType}|${sort}`;
  const fetchPage = useCallback(
    (offset: number, limit: number) => searchContent({ query: q, tag: tagSlug, mediaType, sort }, offset, limit),
    [q, tagSlug, mediaType, sort],
  );
  const results = useInfiniteList(fetchPage, key, PAGE_SIZE);
  const ads = useActiveAds();
  const entries = useMemo(() => insertAdsIntoFeed(results.items, ads), [results.items, ads]);

  useEffect(() => {
    let live = true;
    setTotal(null);
    searchCount({ query: q, tag: tagSlug, mediaType }).then((n) => {
      if (!live) return;
      setTotal(n);
      if (q && mediaType === 'all' && !tagSlug) logSearch(q, n); // popular-search analytics (anonymous)
    });
    return () => { live = false; };
  }, [q, tagSlug, mediaType]);

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  const heading = q ? `Results for “${q}”` : tagSlug ? `#${tag?.name ?? tagSlug}` : 'Browse everything';
  const sortOptions = q ? SEARCH_SORTS : SEARCH_SORTS.filter((s) => s.value !== 'relevance');

  return (
    <div className="space-y-5">
      {isMobile && <SearchBar autoFocus={!q && !tagSlug} />}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-extrabold sm:text-3xl">{heading}</h1>
            <p className="mt-1 text-sm text-muted" aria-live="polite">
              {total !== null
                ? `${total.toLocaleString()} result${total === 1 ? '' : 's'}`
                : results.initialized ? `${results.items.length}${results.hasMore ? '+' : ''} shown` : 'Searching…'}
              {q && tagSlug && <> in #{tag?.name ?? tagSlug}</>}
            </p>
          </div>
          <Segmented label="Media type" options={MEDIA_FILTERS} value={mediaType} onChange={(t) => update('type', t === 'all' ? null : t)} size="sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted" id="sort-label">Sort by</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="sort-label">
            {sortOptions.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={sort === s.value}
                onClick={() => update('sort', s.param)}
                className={`pill py-1 text-[13px] ${sort === s.value ? 'pill-on' : 'pill-off'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <CategoryBar />
      </div>

      {!results.initialized && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {results.initialized && results.error && results.items.length === 0 && (
        <ErrorState message="Search is unavailable right now. Retry in a moment." onRetry={results.loadMore} />
      )}

      {results.initialized && !results.error && results.items.length === 0 && (
        <EmptyState title={q || tagSlug ? 'No matches' : 'Nothing posted yet'}>
          {q ? (
            <>
              Try a shorter word or a different spelling, or <Link className="text-flame-soft underline" to="/search">browse everything</Link>.
              {popular.searches.length > 0 && (
                <span className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {popular.searches.slice(0, 6).map((s) => (
                    <Link key={s.value} to={`/search?q=${encodeURIComponent(s.value)}`} className="tag-chip">{s.label}</Link>
                  ))}
                </span>
              )}
            </>
          ) : 'Check back soon.'}
        </EmptyState>
      )}

      {results.items.length > 0 && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entries.map((e, i) =>
            e.kind === 'ad'
              ? <AdSlot key={e.key} ad={e.ad} className="self-start" />
              : <ContentResultCard key={e.key} item={e.item} priority={i < 2} />,
          )}
        </div>
      )}

      {results.initialized && results.items.length > 0 && (
        <ListFooter loading={results.loading} error={results.error} hasMore={results.hasMore} count={results.items.length} onMore={results.loadMore} />
      )}
    </div>
  );
}
