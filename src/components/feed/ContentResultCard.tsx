import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, Image as ImageIcon } from 'lucide-react';
import type { ContentItem } from '../../types';
import { MediaView } from '../media/MediaView';
import { TagList } from '../ui/TagChip';
import { compactNumber, timeAgo, formatDate } from '../../utils/format';
import { SITE } from '../../lib/site';

/** Discovery card: thumbnail, title, uploader, views, likes, date, tags, media type. */
export const ContentResultCard = memo(function ContentResultCard({ item, priority = false }: { item: ContentItem; priority?: boolean }) {
  const uploader = item.uploader_name || SITE.name;
  return (
    <article className="group min-w-0">
      <Link
        to={`/content/${item.id}`}
        className="relative block overflow-hidden rounded-xl bg-ink-3 ring-1 ring-inset ring-white/5 transition-transform duration-200 group-hover:-translate-y-0.5"
        aria-label={item.title}
      >
        <div className="aspect-video w-full overflow-hidden">
          <MediaView item={item} variant="thumb" priority={priority} />
        </div>
        {item.media_type === 'image' && (
          <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            <ImageIcon className="h-3 w-3" aria-hidden="true" /> Photo
          </span>
        )}
        <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          <Eye className="h-3 w-3" aria-hidden="true" /> {compactNumber(item.view_count)}
        </span>
      </Link>
      <div className="mt-2.5 space-y-1.5">
        <Link to={`/content/${item.id}`} className="block rounded">
          <h3 className="line-clamp-2 text-[0.98rem] font-semibold leading-snug group-hover:text-flame-soft">{item.title}</h3>
        </Link>
        <p className="truncate text-xs font-medium text-fg/85">{uploader}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span>{compactNumber(item.view_count)} views</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" aria-hidden="true" />
            {compactNumber(item.like_count)}
            <span className="sr-only">likes</span>
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.created_at} title={formatDate(item.created_at)}>{timeAgo(item.created_at)}</time>
        </p>
        <TagList tags={item.tags} max={3} />
      </div>
    </article>
  );
});

export const ContentCard = ContentResultCard;
