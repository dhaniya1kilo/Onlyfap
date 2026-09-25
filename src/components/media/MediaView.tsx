import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ImageOff, Play } from 'lucide-react';
import type { ContentItem } from '../../types';
import { useInView } from '../../hooks/useInView';

type Variant = 'thumb' | 'feed' | 'detail' | 'reel';
type MediaItem = Pick<ContentItem, 'media_url' | 'media_type' | 'title' | 'mime_type'> & { thumbnail_url?: string | null };

interface Props {
  item: MediaItem;
  variant: Variant;
  className?: string;
  /** 'reel' only: shared mute state so unmuting persists while swiping. */
  muted?: boolean;
  /** 'reel' only: true while this slide is the one on screen (parent decides). */
  active?: boolean;
  /** 'reel' only: double-tap handler (used for the heart). */
  onDoubleTap?: () => void;
  /** Exposes the <video> element (for fullscreen / external controls). */
  videoRef?: MutableRefObject<HTMLVideoElement | null>;
  /** Image loading priority hint for the first visible item (LCP). */
  priority?: boolean;
}

function Fallback({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 bg-ink-3 text-muted">
      <ImageOff className="h-6 w-6" aria-hidden="true" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function MediaView(props: Props) {
  if (props.item.media_type === 'video') return <VideoMedia {...props} />;
  return <ImageMedia {...props} />;
}

function ImageMedia({ item, variant, className = '', priority, onDoubleTap }: Props) {
  const [failed, setFailed] = useState(false);
  const near = useInView<HTMLDivElement>({ rootMargin: '150% 0px', once: true });
  const lastTap = useRef(0);
  if (failed || !item.media_url) return <Fallback label="Image unavailable" />;

  if (variant === 'reel') {
    const onClick = () => {
      const now = Date.now();
      if (now - lastTap.current < 300) onDoubleTap?.();
      lastTap.current = now;
    };
    return (
      <div ref={near.ref} onClick={onClick} className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
        {(near.inView || priority) && (
          <>
            <img src={item.media_url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
            <img
              src={item.media_url}
              alt={item.title}
              decoding="async"
              onError={() => setFailed(true)}
              className="absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
            />
          </>
        )}
      </div>
    );
  }

  const fit = variant === 'thumb' ? 'h-full w-full object-cover' : 'mx-auto max-h-[80vh] w-full object-contain';
  return (
    <img
      src={variant === 'thumb' && item.thumbnail_url ? item.thumbnail_url : item.media_url}
      alt={item.title}
      loading={variant === 'detail' || priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={`${fit} ${className}`}
    />
  );
}

/**
 * Videos only receive a `src` when near the viewport, autoplay MUTED when
 * visible (browsers block autoplay with sound), and pause when scrolled away.
 * In the reel, far-away videos are unmounted to free memory and decoders.
 */
function VideoMedia({ item, variant, className = '', muted, active, onDoubleTap, videoRef: externalRef, priority }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isReel = variant === 'reel';
  const near = useInView<HTMLDivElement>({ rootMargin: isReel ? '120% 0px' : '300px 0px', once: !isReel });
  const visible = useInView<HTMLDivElement>({ threshold: [0, 0.6] });
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [paused, setPaused] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const progress = useRef<HTMLDivElement | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reelMuted = muted ?? true;

  const setVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (externalRef) externalRef.current = el;
  };

  // Decide whether this video should be playing.
  const shouldPlay = isReel ? Boolean(active) && !userPaused : variant !== 'thumb' && visible.ratio >= 0.6;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || variant === 'thumb') return;
    if (shouldPlay) {
      v.muted = isReel ? reelMuted : v.muted;
      v.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    } else {
      v.pause();
    }
  }, [shouldPlay, near.inView, variant, isReel, reelMuted]);

  // Forget a manual pause once the slide leaves the screen.
  useEffect(() => {
    if (isReel && !active) setUserPaused(false);
  }, [isReel, active]);

  useEffect(() => {
    if (isReel && videoRef.current) videoRef.current.muted = reelMuted;
  }, [isReel, reelMuted]);

  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); }, []);

  if (failed || !item.media_url) return <Fallback label="Video unavailable" />;

  const setRefs = (el: HTMLDivElement | null) => {
    near.ref.current = el;
    visible.ref.current = el;
  };

  if (variant === 'thumb') {
    const showVideo = near.inView && (!item.thumbnail_url || hovering);
    return (
      <div
        ref={setRefs}
        className={`relative h-full w-full bg-black ${className}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {item.thumbnail_url && (
          <img src={item.thumbnail_url} alt={item.title} loading={priority ? 'eager' : 'lazy'} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {showVideo && (
          <video
            ref={setVideo}
            src={item.thumbnail_url ? item.media_url : `${item.media_url}#t=0.1`}
            muted
            playsInline
            loop
            preload="metadata"
            autoPlay={hovering}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
            aria-label={item.title}
          />
        )}
        <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          <Play className="h-3 w-3" aria-hidden="true" fill="currentColor" /> Video
        </span>
      </div>
    );
  }

  if (isReel) {
    const togglePlay = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        setUserPaused(false);
        v.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      } else {
        setUserPaused(true);
        v.pause();
      }
    };
    // Single tap = play/pause, double tap = like (Instagram-style gesture pattern).
    const onTap = () => {
      const now = Date.now();
      if (now - lastTap.current < 280) {
        if (tapTimer.current) clearTimeout(tapTimer.current);
        tapTimer.current = null;
        lastTap.current = 0;
        onDoubleTap?.();
        return;
      }
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        togglePlay();
      }, 280);
    };
    return (
      <div ref={setRefs} className={`relative h-full w-full bg-black ${className}`}>
        {item.thumbnail_url && (
          <img src={item.thumbnail_url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {near.inView && (
          <video
            ref={setVideo}
            src={item.media_url}
            poster={item.thumbnail_url ?? undefined}
            muted={reelMuted}
            playsInline
            loop
            preload={active || priority ? 'auto' : 'metadata'}
            onError={() => setFailed(true)}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (progress.current && v.duration) progress.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
            }}
            className="absolute inset-0 h-full w-full object-contain"
            aria-label={item.title}
          />
        )}
        {/* tap layer (below the overlay controls) */}
        <button
          type="button"
          onClick={onTap}
          aria-label={paused ? 'Play video' : 'Pause video'}
          className="absolute inset-0 z-[1] flex items-center justify-center focus-visible:outline-none"
        >
          {(userPaused || blocked) && (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white">
              <Play className="h-7 w-7 translate-x-0.5" aria-hidden="true" fill="currentColor" />
            </span>
          )}
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-0.5 bg-white/15">
          <div ref={progress} className="h-full origin-left scale-x-0 bg-flame-soft" />
        </div>
      </div>
    );
  }

  // 'detail' and 'feed'
  return (
    <div ref={setRefs} className={`relative w-full bg-black ${className}`}>
      {near.inView || priority ? (
        <video
          ref={setVideo}
          src={item.media_url}
          poster={item.thumbnail_url ?? undefined}
          muted
          playsInline
          loop={variant === 'feed'}
          controls
          preload={variant === 'detail' ? 'auto' : 'metadata'}
          onError={() => setFailed(true)}
          className="mx-auto max-h-[80vh] w-full"
          aria-label={item.title}
        />
      ) : (
        <div className="aspect-video w-full" />
      )}
      {blocked && (
        <p className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
          Press play to watch
        </p>
      )}
    </div>
  );
}
