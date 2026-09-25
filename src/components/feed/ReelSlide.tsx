import { memo, useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, Info, Maximize, Volume2, VolumeX } from 'lucide-react';
import type { ContentItem } from '../../types';
import { MediaView } from '../media/MediaView';
import { TagList } from '../ui/TagChip';
import { LikeButton } from '../engagement/LikeButton';
import { ShareButton } from '../engagement/ShareButton';
import { ReportButton } from '../engagement/ReportDialog';
import { useInView } from '../../hooks/useInView';
import { useViewTracker } from '../../hooks/useViewTracker';
import { useLike, NeedLoginError } from '../../services/likeService';
import { compactNumber, timeAgo } from '../../utils/format';
import { toggleFullscreen } from '../../utils/fullscreen';
import { SITE } from '../../lib/site';
import { toast } from '../ui/Toast';

interface Props {
  item: ContentItem;
  muted: boolean;
  onToggleMute: () => void;
  /** First slide: load eagerly. */
  priority?: boolean;
}

/**
 * One full-viewport slide of the vertical feed: full-bleed media, caption
 * overlay (bottom-left) and an action rail (right). Original OnlyFap UI.
 */
export const ReelSlide = memo(function ReelSlide({ item, muted, onToggleMute, priority }: Props) {
  const section = useRef<HTMLElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const seen = useInView<HTMLElement>({ threshold: [0, 0.75] });
  const active = seen.ratio >= 0.75;
  const [views, setViews] = useState(item.view_count);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(0);
  const like = useLike(item.id, item.like_count);

  useViewTracker(item.id, active, () => setViews((v) => v + 1));

  const setRef = (el: HTMLElement | null) => {
    section.current = el;
    seen.ref.current = el;
  };

  // Double-tap: always LIKE (never unlike), with a heart burst — the familiar gesture.
  const onDoubleTap = useCallback(() => {
    setBurst((b) => b + 1);
    if (!like.liked) {
      like.toggle().catch((err) => {
        toast(err instanceof NeedLoginError ? 'Log in to like posts' : 'Could not like this post');
      });
    }
  }, [like]);

  const uploader = item.uploader_name || SITE.name;

  return (
    <section
      ref={setRef}
      aria-label={item.title}
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-black"
    >
      <MediaView item={item} variant="reel" muted={muted} active={active} onDoubleTap={onDoubleTap} videoRef={video} priority={priority} />

      {burst > 0 && (
        <div key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center">
          <Heart className="h-28 w-28 animate-heart-pop fill-flame text-flame drop-shadow-[0_4px_24px_rgba(225,29,72,0.6)]" />
        </div>
      )}

      {/* readability scrims */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-3/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex items-end justify-between gap-3 p-4 pb-5 sm:p-6">
        {/* caption */}
        <div className="pointer-events-auto min-w-0 max-w-xl space-y-2 text-white text-shadow">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-flame-soft to-velvet font-display text-sm font-bold" aria-hidden="true">
              {uploader.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 text-sm leading-tight">
              <p className="truncate font-semibold">{uploader}</p>
              <p className="text-xs text-white/75">
                <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                <span aria-hidden="true"> · </span>
                <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden="true" />{compactNumber(views)} views</span>
              </p>
            </div>
          </div>
          <h2 className="break-words text-lg font-bold leading-snug">
            <Link to={`/content/${item.id}`} className="hover:underline">{item.title}</Link>
          </h2>
          {item.description && (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              className={`block max-w-lg text-left text-sm leading-relaxed text-white/85 ${expanded ? 'max-h-40 overflow-y-auto' : 'line-clamp-2'}`}
            >
              {item.description}
            </button>
          )}
          <TagList tags={item.tags} max={expanded ? 12 : 3} />
        </div>

        {/* action rail */}
        <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-3.5">
          <LikeButton id={item.id} count={item.like_count} variant="rail" />
          <ShareButton id={item.id} title={item.title} variant="rail" />
          <ReportButton item={{ id: item.id, title: item.title }} variant="rail" />
          {item.media_type === 'video' && (
            <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={!muted} className="rail-btn">
              {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
            </button>
          )}
          <button type="button" onClick={() => void toggleFullscreen(section.current, video.current)} aria-label="Fullscreen" className="rail-btn">
            <Maximize className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link to={`/content/${item.id}`} aria-label="Details and related posts" className="rail-btn">
            <Info className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
});
