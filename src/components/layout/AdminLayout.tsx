import { Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { ADMIN_LINKS } from './ProfileMenu';
import { useAuth } from '../../context/AuthContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Spinner } from '../ui/States';

export function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-flame text-white' : 'text-fg hover:bg-ink-3'}`;
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <nav aria-label="Admin" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-52 lg:flex-col lg:overflow-visible lg:px-0">
          <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted lg:block">OnlyFap admin</p>
          {ADMIN_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/admin'} className={cls}>{l.label}</NavLink>
          ))}
          <button
            onClick={async () => { await signOut().catch(() => undefined); navigate('/'); }}
            className="shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger hover:bg-ink-3"
          >
            Log out
          </button>
        </nav>
        <main id="main" className="min-w-0 flex-1">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<Spinner label="Loading" />}><Outlet /></Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
