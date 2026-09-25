import { NavLink } from 'react-router-dom';
import { Flame, Heart, Search, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/** Bottom navigation on phones. Static inside immersive layouts, fixed elsewhere. */
export function MobileNav({ fixed }: { fixed: boolean }) {
  const { user, isAnonymous } = useAuth();
  const items = [
    { to: '/', label: 'Trending', Icon: Flame, end: true },
    { to: '/search', label: 'Search', Icon: Search, end: false },
    { to: '/liked', label: 'Liked', Icon: Heart, end: false },
    { to: user && !isAnonymous ? '/account' : '/login', label: user && !isAnonymous ? 'Account' : 'Log in', Icon: UserRound, end: false },
  ];
  return (
    <nav
      aria-label="Main"
      className={`${fixed ? 'fixed inset-x-0 bottom-0' : 'relative'} z-40 border-t border-white/10 bg-ink/95 pb-safe backdrop-blur md:hidden`}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ to, label, Icon, end }) => (
          <li key={label}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }: { isActive: boolean }) =>
                `flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-fg' : 'text-muted hover:text-fg'}`
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-flame-soft' : ''}`} aria-hidden="true" strokeWidth={isActive ? 2.4 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
