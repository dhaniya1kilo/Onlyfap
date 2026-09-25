import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Spinner } from '../ui/States';
import { useIsMobile } from '../../hooks/useMediaQuery';

export function PublicLayout() {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  // Immersive = the full-screen vertical feed owns the viewport (no page scroll, no footer).
  const immersive = pathname === '/feed' || (isMobile && (pathname === '/' || pathname.startsWith('/content/')));
  const showHeader = !(immersive && isMobile);

  return (
    <div className={immersive ? 'flex h-dvh flex-col overflow-hidden bg-black' : 'flex min-h-dvh flex-col pb-14 md:pb-0'}>
      <a href="#main" className="btn-primary sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">Skip to content</a>
      {showHeader && <Header />}
      <main
        id="main"
        className={immersive ? 'relative min-h-0 flex-1 overflow-hidden' : 'mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:py-6'}
      >
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<Spinner label="Loading" />}><Outlet /></Suspense>
        </ErrorBoundary>
      </main>
      {!immersive && <Footer />}
      <MobileNav fixed={!immersive} />
    </div>
  );
}
