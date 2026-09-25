import type { MouseEvent } from 'react';
import { Share2 } from 'lucide-react';
import { absoluteUrl } from '../../lib/site';
import { toast } from '../ui/Toast';

/** Uses the Web Share sheet when available, otherwise copies the link. */
export function ShareButton({ id, title, variant = 'inline' }: { id: string; title: string; variant?: 'rail' | 'inline' }) {
  const share = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = absoluteUrl(`/content/${id}`);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      toast('Could not share. Copy the address bar link instead.');
    }
  };

  if (variant === 'rail') {
    return (
      <div className="flex flex-col items-center gap-1">
        <button type="button" onClick={share} className="rail-btn" aria-label="Share">
          <Share2 className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-xs font-semibold text-white text-shadow" aria-hidden="true">Share</span>
      </div>
    );
  }
  return (
    <button type="button" onClick={share} className="btn-ghost">
      <Share2 className="h-4 w-4" aria-hidden="true" /> Share
    </button>
  );
}
