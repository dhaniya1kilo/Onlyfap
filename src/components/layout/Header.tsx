import { Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { SearchBar } from './SearchBar';
import { ProfileMenu } from './ProfileMenu';

const NAV = [
  { to: '/', label: 'Trending', match: (p: string, s: string) => p === '/' && !s.includes('sort=') },
  { to: '/?sort=most-viewed', label: 'Most viewed', match: (p: string, s: string) => p === '/' && s.includes('sort=most-viewed') },
  { to: '/?sort=new', label: 'New', match: (p: string, s: string) => p === '/' && s.includes('sort=new') },
  { to: '/feed', label: 'Feed', match: (p: string) => p === '/feed' },
];

export function Header() {
  const { pathname, search } = useLocation();
  return (
    <header className="sticky top-0 z-40 bg-ink/90 backdrop-blur supports-[backdrop-filter]:bg-ink/75">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 md:gap-5 md:py-3">
        <Logo />
        <nav aria-label="Discover" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => {
            const on = n.match(pathname, search);
            return (
              <Link
                key={n.label}
                to={n.to}
                aria-current={on ? 'page' : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-ink-3 text-fg' : 'text-muted hover:text-fg'}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden flex-1 justify-center md:flex">
          <div className="w-full max-w-xl"><SearchBar /></div>
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link to="/search" aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-line bg-ink-2 hover:border-flame-soft md:hidden">
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          <ProfileMenu />
        </div>
      </div>
      <div className="brand-rule" aria-hidden="true" />
    </header>
  );
}
