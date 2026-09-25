import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Eye, Heart, Maximize, ShieldAlert } from 'lucide-react';
import type { ContentItem } from '../types';
import { fetchContentById, fetchRelated } from '../services/contentService';
import { MediaView } from '../components/media/MediaView';
import { TagChip } from '../components/ui/TagChip';
import { ContentResultCard } from '../components/feed/ContentResultCard';
import { ReelsFeed } from '../components/feed/ReelsFeed';
import { FeedTopBar } from '../components/feed/FeedTopBar';
import { LikeButton } from '../components/engagement/LikeButton';
import { ShareButton } from '../components/engagement/ShareButton';
import { ReportButton } from '../components/engagement/ReportDialog';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';
import { useSeo } from '../hooks/useSeo';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useViewTracker } from '../hooks/useViewTracker';
import { useActiveAds } from '../hooks/useActiveAds';
import { useLike } from '../services/likeService';
import { compactNumber, formatDate } from '../utils/format';
import { insertAdsIntoFeed } from '../utils/insertAds';
import { toggleFullscreen } from '../utils/fullscreen';
import { friendlyError } from '../lib/errors';
import { SITE, absoluteUrl } from '../lib/site';
import { useAuth } from '../context/AuthContext';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export default function ContentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState('');
  const [related, setRelated] = useState<ContentItem[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useSeo({
    title: item?.title ?? (state === 'missing' ? 'Not available' : undefined),
    description: item ? clip(item.description || item.title, 160) : undefined,
    canonical: `/content/${id}`,
    image: item ? item.thumbnail_url ?? (item.media_type === 'image' ? item.media_url : null) : null,
    type: item?.media_type === 'video' ? 'video.other' : 'article',
    noindex: state === 'missing' || (item ? item.moderation_state !== 'active' || !item.is_published : false),
    jsonLd: item
      ? item.media_type === 'video'
        ? {
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: item.title,
            description: clip(item.description || item.title, 300),
            thumbnailUrl: item.thumbnail_url ? [item.thumbnail_url] : undefined,
            uploadDate: item.created_at,
            contentUrl: item.media_url,
            url: absoluteUrl(`/content/${item.id}`),
            isFamilyFriendly: false,
            keywords: item.tags.map((t) => t.name).join(', ') || undefined,
            interactionStatistic: [
              { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: item.view_count },
              { '@type': 'InteractionCounter', interactionType: { '@type': 'LikeAction' }, userInteractionCount: item.like_count },
            ],
          }
        : {
            '@context': 'https://schema.org',
            '@type': 'ImageObject',
            name: item.title,
            description: clip(item.description || item.title, 300),
            contentUrl: item.media_url,
            uploadDate: item.created_at,
            isFamilyFriendly: false,
          }
      : null,
  });

  useEffect(() => {
    let live = true;
    setItem(null);
    setRelated(null);
    if (!UUID.test(id)) {
      setState('missing');
      return;
    }
    setState('loading');
    fetchContentById(id)
      .then((c) => {
        if (!live) return;
        if (!c) return setState('missing');
        setItem(c);
        setState('ready');
        fetchRelated(c.id, 12).then((r) => live && setRelated(r)).catch(() => live && setRelated([]));
      })
      .catch((e) => {
        if (!live) return;
        setError(friendlyError(e, 'Could not load this post.'));
        setState('error');
      });
    return () => { live = false; };
  }, [id, attempt]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  if (state === 'loading') return <div className="flex h-full min-h-[50vh] items-center justify-center"><Spinner label="Loading" /></div>;
  if (state === 'error') return <div className="p-4"><ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} /></div>;
  if (state === 'missing' || !item)
    return (
      <div className="px-4">
        <EmptyState title="This post isn't available">
          It may have been removed or hidden. <Link to="/" className="text-flame-soft underline">Back to trending</Link>
        </EmptyState>
      </div>
    );

  if (isMobile) return <MobileViewer item={item} related={related} onBack={back} />;
  return <DesktopViewer item={item} related={related} onBack={back} />;
}

/** Phones: this post first, then related posts, in the vertical feed. */
function MobileViewer({ item, related, onBack }: { item: ContentItem; related: ContentItem[] | null; onBack: () => void }) {
  const ads = useActiveAds();
  const items = useMemo(() => [item, ...(related ?? []).filter((r) => r.id !== item.id)], [item, related]);
  const entries = useMemo(() => insertAdsIntoFeed(items, ads), [items, ads]);
  return (
    <ReelsFeed
      key={item.id}
      entries={entries}
      loading={related === null}
      error={null}
      hasMore={false}
      initialized
      onLoadMore={() => undefined}
      topBar={
        <FeedTopBar
          title={related && related.length > 0 ? 'Swipe for more like this' : ''}
          left={
            <button type="button" onClick={onBack} aria-label="Back" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          }
        />
      }
      endActions={<Link className="btn-primary" to="/">Trending</Link>}
    />
  );
}

function DesktopViewer({ item, related, onBack }: { item: ContentItem; related: ContentItem[] | null; onBack: () => void }) {
  const { isAdmin } = useAuth();
  const stage = useRef<HTMLDivElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const [views, setViews] = useState(item.view_count);
  const like = useLike(item.id, item.like_count);
  useViewTracker(item.id, true, () => setViews((v) => v + 1));
  const uploader = item.uploader_name || SITE.name;
  const hiddenForPublic = !item.is_published || item.moderation_state === 'hidden' || item.moderation_state === 'removed';

  return (
    <div className="space-y-10">
      <button onClick={onBack} className="btn-ghost -ml-1"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back</button>

      {isAdmin && (hiddenForPublic || item.moderation_state === 'under_review') && (
        <p role="note" className="panel flex items-center gap-2 border-flame/50 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 text-flame-soft" aria-hidden="true" />
          {hiddenForPublic ? 'Not visible to the public' : 'Under review (still visible)'} — state: <strong>{item.is_published ? item.moderation_state : 'unpublished'}</strong>.
          <Link to={`/admin/content/${item.id}/edit`} className="ml-auto text-flame-soft underline">Manage</Link>
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={stage} className="group relative flex items-center justify-center overflow-hidden rounded-2xl bg-black [&:fullscreen]:rounded-none">
          <MediaView item={item} variant="detail" videoRef={video} priority />
          <button
            type="button"
            onClick={() => void toggleFullscreen(stage.current, video.current)}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white opacity-90 backdrop-blur-sm transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Toggle fullscreen"
          >
            <Maximize className="h-3.5 w-3.5" aria-hidden="true" /> Fullscreen
          </button>
        </div>

        <section aria-labelledby="content-title" className="space-y-5">
          <h1 id="content-title" className="break-words text-2xl font-extrabold xl:text-3xl">{item.title}</h1>

          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-flame-soft to-velvet font-display font-bold" aria-hidden="true">
              {uploader.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{uploader}</p>
              <p className="text-xs text-muted">Uploader</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="panel px-2 py-3">
              <dt className="flex items-center justify-center gap-1 text-xs text-muted"><Eye className="h-3.5 w-3.5" aria-hidden="true" />Views</dt>
              <dd className="font-display text-lg font-bold">{compactNumber(views)}</dd>
            </div>
            <div className="panel px-2 py-3">
              <dt className="flex items-center justify-center gap-1 text-xs text-muted"><Heart className="h-3.5 w-3.5" aria-hidden="true" />Likes</dt>
              <dd className="font-display text-lg font-bold">{compactNumber(like.count)}</dd>
            </div>
            <div className="panel px-2 py-3">
              <dt className="flex items-center justify-center gap-1 text-xs text-muted"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />Posted</dt>
              <dd className="text-sm font-semibold leading-7"><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <LikeButton id={item.id} count={item.like_count} />
            <ShareButton id={item.id} title={item.title} />
            <Link to={`/feed`} className="btn-ghost">Vertical feed</Link>
          </div>

          {item.description && <p className="whitespace-pre-line break-words leading-relaxed text-fg/90">{item.description}</p>}

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Tags">{item.tags.map((t) => <TagChip key={t.id} tag={t} />)}</div>
          )}

          <p className="text-xs capitalize text-muted">{item.media_type === 'video' ? 'Video' : 'Photo'}</p>

          <div className="border-t border-ink-line pt-4">
            <ReportButton item={{ id: item.id, title: item.title }} variant="link" />
          </div>
        </section>
      </div>

      <section aria-labelledby="related-h" className="space-y-4">
        <h2 id="related-h" className="text-2xl font-bold">More like this</h2>
        {related === null ? (
          <Spinner label="Finding related posts" />
        ) : related.length === 0 ? (
          <p className="text-sm text-muted">No related posts yet. <Link to="/" className="text-flame-soft underline">See what's trending</Link></p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-3 xl:grid-cols-4">
            {related.map((r) => <ContentResultCard key={r.id} item={r} />)}
          </div>
        )}
      </section>
    </div>
  );
}
