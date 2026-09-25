import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Film, Hash, Search, TrendingUp, X } from 'lucide-react';
import type { SearchSuggestion } from '../../types';
import { fetchSuggestions } from '../../services/searchService';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '../../lib/recentSearches';
import { SITE } from '../../lib/site';

type Option =
  | { kind: 'recent'; label: string; value: string }
  | SearchSuggestion;

const GROUP_TITLE: Record<Option['kind'], string> = {
  recent: 'Recent on this device',
  query: 'Popular searches',
  tag: 'Tags',
  content: 'Posts',
};

/**
 * Search with suggestions (ARIA combobox). Suggestions come from the
 * database: popular searches, popular tags and matching titles. Recent
 * searches are stored only on this device.
 */
export function SearchBar({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const uid = useId();
  const listId = `${uid}-list`;
  const urlQuery = location.pathname === '/search' ? params.get('q') ?? '' : '';
  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<SearchSuggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(urlQuery), [urlQuery]);

  // Debounced suggestion fetch while open.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(() => {
      fetchSuggestions(value, 8).then((s) => live && setRemote(s)).catch(() => live && setRemote([]));
    }, value ? 150 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const options: Option[] = useMemo(() => {
    const q = value.trim().toLowerCase();
    const rec: Option[] = recent
      .filter((r) => !q || r.toLowerCase().startsWith(q))
      .slice(0, q ? 2 : 4)
      .map((r) => ({ kind: 'recent', label: r, value: r }));
    const seen = new Set(rec.map((r) => r.label.toLowerCase()));
    const rest = remote.filter((s) => s.kind !== 'query' || !seen.has(s.label.toLowerCase()));
    return [...rec, ...rest];
  }, [recent, remote, value]);

  const go = (opt: Option | null) => {
    setOpen(false);
    setActive(-1);
    input.current?.blur();
    onNavigate?.();
    if (!opt) {
      const q = value.trim();
      if (q) addRecentSearch(q);
      navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      return;
    }
    if (opt.kind === 'tag') navigate(`/search?tag=${encodeURIComponent(opt.value)}`);
    else if (opt.kind === 'content') navigate(`/content/${encodeURIComponent(opt.value)}`);
    else {
      addRecentSearch(opt.value);
      setValue(opt.value);
      navigate(`/search?q=${encodeURIComponent(opt.value)}`);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(active >= 0 ? options[active] ?? null : null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (options.length ? (a + 1) % options.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const show = open && options.length > 0;
  let lastKind: Option['kind'] | null = null;

  return (
    <div ref={box} className="relative w-full">
      <form role="search" onSubmit={submit} className="relative w-full">
        <label htmlFor={`${uid}-q`} className="sr-only">Search {SITE.name}</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          ref={input}
          id={`${uid}-q`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={show}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => { setRecent(getRecentSearches()); setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder="Search videos, photos and tags"
          autoFocus={autoFocus}
          maxLength={80}
          enterKeyHint="search"
          autoComplete="off"
          className="input rounded-full py-2 pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => { setValue(''); input.current?.focus(); if (location.pathname === '/search' && params.get('q')) navigate('/search'); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:text-fg"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {show && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="panel absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto p-1.5 shadow-2xl shadow-black/50"
        >
          {options.map((o, i) => {
            const header = o.kind !== lastKind ? GROUP_TITLE[o.kind] : null;
            lastKind = o.kind;
            const Icon = o.kind === 'recent' ? Clock : o.kind === 'query' ? TrendingUp : o.kind === 'tag' ? Hash : Film;
            return (
              <li key={`${o.kind}-${o.value}`} role="presentation">
                {header && (
                  <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted" role="presentation">
                    {header}
                    {o.kind === 'recent' && (
                      <button
                        type="button"
                        className="normal-case tracking-normal text-muted underline hover:text-fg"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { clearRecentSearches(); setRecent([]); }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
                <div
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${i === active ? 'bg-ink-3 text-fg' : 'text-fg/90'}`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="truncate">{o.kind === 'tag' ? `#${o.label}` : o.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
