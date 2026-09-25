import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { LogoMark } from '../components/ui/Logo';

function AuthShell({ title, children, foot }: { title: string; children: ReactNode; foot: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <LogoMark className="h-12 w-12" />
        <h1 className="text-3xl font-extrabold">{title}</h1>
      </div>
      <div className="panel p-6">{children}</div>
      <p className="mt-4 text-center text-sm text-muted">{foot}</p>
    </div>
  );
}

/** Only allow same-site relative redirects after login. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account';
}

export function LoginPage() {
  useDocumentTitle('Log in', true);
  const { signIn, user, loading } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(params.get('next'));

  if (!loading && user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // The redirect happens above once the session AND profile are loaded.
    } catch (err) {
      setError(friendlyError(err, 'Could not log in. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Log in to OnlyFap" foot={<>New here? <Link to="/signup" className="text-flame-soft underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-[#ff8fb6]">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={busy || !email || !password}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthShell>
  );
}

export function SignupPage() {
  useDocumentTitle('Sign up', true);
  const { signUp, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!loading && user && !sent) return <Navigate to="/account" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp(email, password);
      if (needsConfirmation) setSent(true);
      // otherwise the <Navigate> above runs once the new session is applied
    } catch (err) {
      setError(friendlyError(err, 'Could not create your account. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <AuthShell title="Check your inbox" foot={<Link to="/login" className="text-flame-soft underline">Go to log in</Link>}>
        <p className="text-sm">We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then log in.</p>
      </AuthShell>
    );

  return (
    <AuthShell title="Join OnlyFap" foot={<>Already have an account? <Link to="/login" className="text-flame-soft underline">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="su-email" className="label">Email</label>
          <input id="su-email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="su-pass" className="label">Password</label>
          <input id="su-pass" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="su-confirm" className="label">Confirm password</label>
          <input id="su-confirm" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-[#ff8fb6]">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
