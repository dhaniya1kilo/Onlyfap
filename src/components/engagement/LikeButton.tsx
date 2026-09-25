import type { MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NeedLoginError, useLike } from '../../services/likeService';
import { friendlyError } from '../../lib/errors';
import { compactNumber } from '../../utils/format';
import { toast } from '../ui/Toast';

interface Props {
  id: string;
  count: number;
  variant?: 'rail' | 'inline' | 'compact';
}

/** Heart button. Optimistic; the database has the final say on state and count. */
export function LikeButton({ id, count, variant = 'inline' }: Props) {
  const like = useLike(id, count);
  const navigate = useNavigate();
  const loc = useLocation();

  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await like.toggle();
    } catch (err) {
      if (err instanceof NeedLoginError) {
        toast('Log in to like posts');
        navigate(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
      } else {
        toast(friendlyError(err, 'Could not update your like.'));
      }
    }
  };

  const label = `${like.liked ? 'Unlike' : 'Like'} (${like.count.toLocaleString()} likes)`;
  const heart = (cls: string) => (
    <Heart
      className={`${cls} transition-transform ${like.liked ? 'scale-110 fill-flame text-flame' : ''}`}
      aria-hidden="true"
      strokeWidth={2.2}
    />
  );

  if (variant === 'rail') {
    return (
      <div className="flex flex-col items-center gap-1">
        <button type="button" onClick={onClick} aria-pressed={like.liked} aria-label={label} className="rail-btn">
          {heart('h-6 w-6')}
        </button>
        <span className="text-xs font-semibold text-white text-shadow" aria-hidden="true">{compactNumber(like.count)}</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button type="button" onClick={onClick} aria-pressed={like.liked} aria-label={label} className="inline-flex items-center gap-1 rounded-full px-1 text-xs text-muted hover:text-fg">
        {heart('h-3.5 w-3.5')}
        <span aria-hidden="true">{compactNumber(like.count)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={like.liked}
      aria-label={label}
      className={`btn border ${like.liked ? 'border-flame/60 bg-flame/15 text-fg' : 'border-ink-line text-fg hover:bg-ink-3'}`}
    >
      {heart('h-4 w-4')}
      <span aria-hidden="true">{compactNumber(like.count)}</span>
      <span className="sr-only">{like.liked ? 'Liked' : 'Like'}</span>
    </button>
  );
}
