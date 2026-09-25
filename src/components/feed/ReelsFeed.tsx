import { Fragment, useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ContentItem } from '../../types';
import type { FeedEntry } from '../../utils/insertAds';
import { ReelSlide } from './ReelSlide';
import { AdSlot } from './AdSlot';
import { Sentinel } from '../ui/Sentinel';
import { Spinner, ErrorState, EmptyState } from '../ui/States';
import { ErrorBoundary } from '../ui/ErrorBoundary';

interface Props {
  entries: FeedEntry<ContentItem>[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  initialized: boolean;
  onLoadMore: () => void;
  /** Overlay bar at the top (logo, sort tabs, search). */
  topBar?: ReactNode;
  endActions?: ReactNode;
}

/**
 * Vertical, snap-scrolling feed: one item per screen. Swipe/scroll, or use
 * ↑/↓, PageUp/PageDown, j/k on a keyboard. Ads sit between items as their
 * own full-screen, clearly labelled slides (after every 5 posts, counted
 * globally across pages by insertAdsIntoFeed).
 */
export function ReelsFeed({ entries, loading, error, hasMore, initialized, onLoadMore, topBar, endActions }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(true);
  const toggleMute = useCallback(() => setMuted((m) => !m), []); // stable → memoised slides don't re-render

  const scrollByScreen = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight, behavior: 'smooth' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [role="dialog"]')) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
      e.preventDefault();
      scrollByScreen(1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
      e.preventDefault();
      scrollByScreen(-1);
    } else if (e.key === 'm') {
      setMuted((m) => !m);
    }
  };

  let body: ReactNode;
  if (!initialized && loading) {
    body = <div className="flex h-full w-full items-center justify-center"><Spinner label="Loading the feed" /></div>;
  } else if (initialized && error && entries.length === 0) {
    body = <div className="flex h-full w-full items-center justify-center px-6"><ErrorState message={error} onRetry={onLoadMore} /></div>;
  } else if (initialized && !error && entries.length === 0) {
    body = (
      <div className="flex h-full w-full items-center justify-center px-6">
        <EmptyState title="Nothing here yet">New videos and photos will show up here as soon as they're posted.</EmptyState>
      </div>
    );
  } else {
    let firstContent = true;
    // Start fetching the next page while ~3 slides remain, not at the very end.
    const prefetchAt = Math.max(0, entries.length - 3);
    body = (
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Vertical feed. Swipe or use the arrow keys to move between posts. Press M to mute or unmute."
        className="no-scrollbar h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain focus-visible:outline-none"
      >
        {entries.map((e, i) => {
          const prefetch = i === prefetchAt && hasMore && !loading
            ? <Sentinel key={`pf-${entries.length}`} onVisible={onLoadMore} />
            : null;
          if (e.kind === 'ad') {
            return (
              <Fragment key={e.key}>
                {prefetch}
                <div className="relative flex h-full w-full shrink-0 snap-start snap-always flex-col items-center justify-center gap-3 bg-ink-2 px-6">
                  <AdSlot ad={e.ad} className="w-full max-w-md" />
                  <p className="text-xs text-muted">Swipe up to keep watching</p>
                </div>
              </Fragment>
            );
          }
          const priority = firstContent;
          firstContent = false;
          return (
            <Fragment key={e.key}>
              {prefetch}
              <ErrorBoundary fallback={null}>
                <ReelSlide item={e.item} muted={muted} onToggleMute={toggleMute} priority={priority} />
              </ErrorBoundary>
            </Fragment>
          );
        })}

        <div className="relative flex h-full w-full shrink-0 snap-start flex-col items-center justify-center gap-4 px-6 text-center">
          <Sentinel onVisible={onLoadMore} disabled={loading || !hasMore} />
          {loading && <Spinner label="Loading more" />}
          {!loading && error && <ErrorState message={error} onRetry={onLoadMore} />}
          {!loading && !error && !hasMore && (
            <>
              <p className="text-lg font-semibold text-fg">You're all caught up</p>
              <p className="max-w-xs text-sm text-muted">Try another tab, or search for something specific.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button className="btn-ghost" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top</button>
                {endActions ?? <Link className="btn-primary" to="/search">Search</Link>}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      {topBar && <div className="pointer-events-none absolute inset-x-0 top-0 z-20">{topBar}</div>}
      {body}
    </div>
  );
}
