import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Tag } from '../../types';
import { fetchCategories } from '../../services/tagService';

/** Categories are simply tags flagged `is_category` in the database. */
export function CategoryBar() {
  const [cats, setCats] = useState<Tag[]>([]);
  const [params] = useSearchParams();
  const active = params.get('tag');

  useEffect(() => {
    let live = true;
    fetchCategories().then((c) => live && setCats(c)).catch(() => live && setCats([]));
    return () => { live = false; };
  }, []);

  if (!cats.length) return null;
  const pill = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? 'bg-flame text-white' : 'bg-ink-2 text-fg hover:bg-ink-3'}`;

  return (
    <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex gap-2 py-1">
        <li><Link to="/search" className={pill(!active)}>All</Link></li>
        {cats.map((c) => (
          <li key={c.id}>
            <Link to={`/search?tag=${encodeURIComponent(c.slug)}`} className={pill(active === c.slug)}>{c.name}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
