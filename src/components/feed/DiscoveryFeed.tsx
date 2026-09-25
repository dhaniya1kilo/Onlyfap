import { useCallback, useMemo } from 'react';
import type { BrowseSort, MediaType } from '../../types';
import { browseContent } from '../../services/contentService';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { useActiveAds } from '../../hooks/useActiveAds';
import { insertAdsIntoFeed } from '../../utils/insertAds';
import { ReelsFeed } from './ReelsFeed';
import { FeedTopBar } from './FeedTopBar';

const PAGE_SIZE = 10;

/** Full-screen vertical feed for a discovery ordering (Trending / Most viewed / New / Old). */
export function DiscoveryFeed({
  sort,
  onSort,
  tag,
  mediaType = 'all',
}: {
  sort: BrowseSort;
  onSort: (s: BrowseSort) => void;
  tag?: string;
  mediaType?: MediaType | 'all';
}) {
  const fetchPage = useCallback(
    (offset: number, limit: number) => browseContent({ sort, tag, mediaType }, offset, limit),
    [sort, tag, mediaType],
  );
  const feed = useInfiniteList(fetchPage, `feed|${sort}|${tag ?? ''}|${mediaType}`, PAGE_SIZE);
  const ads = useActiveAds();
  // Recomputed over the FULL accumulated list → the ad counter is global across pages.
  const entries = useMemo(() => insertAdsIntoFeed(feed.items, ads), [feed.items, ads]);

  return (
    <ReelsFeed
      key={sort /* new ordering → start at the top */}
      entries={entries}
      loading={feed.loading}
      error={feed.error}
      hasMore={feed.hasMore}
      initialized={feed.initialized}
      onLoadMore={feed.loadMore}
      topBar={<FeedTopBar sort={sort} onSort={onSort} />}
    />
  );
}
