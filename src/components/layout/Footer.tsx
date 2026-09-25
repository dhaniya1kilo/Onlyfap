import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { LEGAL_PAGES } from '../../content/legal';
import { revokeAgeAcceptance } from '../../lib/ageVerification';
import { SITE } from '../../lib/site';

export function Footer() {
  const navigate = useNavigate();
  const link = 'text-muted hover:text-fg';
  const resetAge = () => {
    revokeAgeAcceptance();
    navigate('/');
  };
  return (
    <footer className="mt-16 border-t border-ink-line">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-muted">{SITE.tagline}</p>
          <p className="inline-flex items-center gap-2 rounded-full border border-flame/40 px-3 py-1 text-xs font-semibold text-flame-soft">
            18+ Adults only
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <nav aria-label="Discover" className="space-y-2 text-sm">
            <p className="font-semibold">Discover</p>
            <ul className="space-y-2">
              <li><Link className={link} to="/">Trending</Link></li>
              <li><Link className={link} to="/?sort=most-viewed">Most viewed</Link></li>
              <li><Link className={link} to="/?sort=new">New</Link></li>
              <li><Link className={link} to="/search">Search</Link></li>
              <li><Link className={link} to="/feed">Vertical feed</Link></li>
            </ul>
          </nav>
          <nav aria-label="Legal" className="space-y-2 text-sm sm:col-span-2">
            <p className="font-semibold">Legal &amp; safety</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {LEGAL_PAGES.map((p) => (
                <li key={p.slug}><Link className={link} to={`/legal/${p.slug}`}>{p.navLabel}</Link></li>
              ))}
              <li><Link className={link} to="/report">Report content</Link></li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-ink-line px-4 py-6 text-xs text-muted sm:flex-row">
        <p>© {new Date().getFullYear()} {SITE.name}. All models appearing on this site must be 18 or older.</p>
        <button type="button" onClick={resetAge} className="underline-offset-2 hover:text-fg hover:underline">
          Reset age confirmation
        </button>
      </div>
    </footer>
  );
}
