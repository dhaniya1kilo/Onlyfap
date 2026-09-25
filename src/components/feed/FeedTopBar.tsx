import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { BrowseSort } from '../../types';
import { BROWSE_SORTS } from '../../lib/labels';
import { LogoMark } from '../ui/Logo';

interface Props {
  sort?: BrowseSort;
  onSort?: (s: BrowseSort) => void;
  left?: ReactNode;
  title?: string;
}

/** Overlay bar for the vertical feed: brand, sort tabs, search. */
export function FeedTopBar({ sort, onSort, left, title }: Props) {
  return (
    <div className="pointer-events-auto flex items-center gap-2 px-3 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))] text-white">
      {left ?? (
        <Link to="/" aria-label="OnlyFap home" className="hidden shrink-0 rounded-lg min-[380px]:block">
          <LogoMark className="h-8 w-8" />
        </Link>
      )}
      {sort && onSort ? (
        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
          <div role="tablist" aria-label="Sort feed" className="mx-auto flex w-max gap-0.5">
          {BROWSE_SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={sort === s.value}
              onClick={() => onSort(s.value)}
              className={`shrink-0 rounded-full px-2 py-1.5 text-[12.5px] min-[390px]:px-2.5 min-[390px]:text-[13px] font-semibold text-shadow transition-colors ${
                sort === s.value ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
          </div>
        </div>
      ) : (
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-shadow">{title}</p>
      )}
      <Link to="/search" aria-label="Search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50">
        <Search className="h-[18px] w-[18px]" aria-hidden="true" />
      </Link>
    </div>
  );
}
