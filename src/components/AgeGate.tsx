import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { LogoMark, Wordmark } from './ui/Logo';
import { SITE } from '../lib/site';
import {
  getAgeProvider,
  isGateExempt,
  readAgeAcceptance,
  saveAgeAcceptance,
} from '../lib/ageVerification';

function useAgeAccepted() {
  const [accepted, setAccepted] = useState(() => readAgeAcceptance() !== null);
  useEffect(() => {
    const sync = () => setAccepted(readAgeAcceptance() !== null);
    window.addEventListener('onlyfap:age-gate', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('onlyfap:age-gate', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return accepted;
}

/**
 * Blocks the whole site until the visitor confirms they are 18+. Site
 * content is NOT mounted (and nothing is fetched) until then.
 */
export function AgeGate({ children }: { children: ReactNode }) {
  const accepted = useAgeAccepted();
  const { pathname } = useLocation();
  if (accepted || isGateExempt(pathname)) return <>{children}</>;
  return <AgeGateScreen />;
}

function AgeGateScreen() {
  const navigate = useNavigate();
  const provider = getAgeProvider();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
    const prev = document.title;
    document.title = `${SITE.name} — 18+ only`;
    return () => { document.title = prev; };
  }, []);

  const yes = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      saveAgeAcceptance(await provider.confirm());
    } catch {
      setError('Age confirmation could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const no = () => {
    const exitUrl = import.meta.env.VITE_AGE_GATE_EXIT_URL;
    if (exitUrl && /^https:\/\//i.test(exitUrl)) {
      window.location.replace(exitUrl);
      return;
    }
    navigate('/exit', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(225,29,72,0.28),transparent_70%),radial-gradient(50%_40%_at_100%_100%,rgba(139,92,246,0.22),transparent_70%)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-desc"
        className="relative mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-6 px-5 py-10 text-center"
      >
        <div className="flex items-center gap-3">
          <LogoMark className="h-14 w-14" />
          <Wordmark className="text-4xl" />
        </div>

        <div className="panel w-full space-y-5 p-6 sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-flame-soft">
            <span className="font-display text-xl font-extrabold text-flame-soft">18+</span>
          </div>
          <h1 id="age-gate-title" ref={heading} tabIndex={-1} className="text-3xl font-extrabold outline-none">
            18+ Only
          </h1>
          <div id="age-gate-desc" className="space-y-3 text-sm leading-relaxed text-fg/90">
            <p>
              This website contains sexually explicit material and is intended <strong>only for adults</strong> who are at
              least 18 years old, or the age of majority where they live if that is higher.
            </p>
            <p className="text-muted">
              By entering you confirm that you are an adult, that viewing adult content is legal where you are, and that
              you agree to our <Link to="/legal/terms" className="text-flame-soft underline">Terms</Link> and{' '}
              <Link to="/legal/age-policy" className="text-flame-soft underline">Age Policy</Link>.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={yes} disabled={busy} className="btn-primary flex-1 py-3 text-base">
              {busy ? 'Please wait…' : 'Yes, I am 18+'}
            </button>
            <button type="button" onClick={no} className="btn-ghost flex-1 py-3 text-base">
              No, exit
            </button>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          {!provider.isFormalVerification && (
            <p className="flex items-start gap-2 rounded-xl bg-ink-3 p-3 text-left text-xs text-muted">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                This is a self-declaration, not a formal age-verification check. Your choice is remembered on this device
                only, and you can reset it any time from the site footer.
              </span>
            </p>
          )}
        </div>

        <p className="text-xs text-muted">
          Parents: filtering tools can block adult sites on your children&apos;s devices. This site labels itself as adult
          content for such filters.
        </p>
      </div>
    </div>
  );
}
