import { Link } from 'react-router-dom';
import type { TagRef } from '../../types';

export function TagChip({ tag }: { tag: TagRef }) {
  return (
    <Link to={`/search?tag=${encodeURIComponent(tag.slug)}`} className="tag-chip" onClick={(e) => e.stopPropagation()}>
      #{tag.name}
    </Link>
  );
}

export function TagList({ tags, max = 4 }: { tags: TagRef[]; max?: number }) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((t) => <TagChip key={t.id} tag={t} />)}
      {tags.length > max && <span className="tag-chip">+{tags.length - max}</span>}
    </div>
  );
}
