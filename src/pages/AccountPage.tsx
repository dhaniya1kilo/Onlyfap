import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ADMIN_LINKS } from '../components/layout/ProfileMenu';
import { formatDate } from '../utils/format';
import { revokeAgeAcceptance } from '../lib/ageVerification';

export default function AccountPage() {
  useDocumentTitle('Account', true);
  const { user, profile, isAdmin, isAnonymous, signOut, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    const clean = name.trim().slice(0, 60);
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('profiles').update({ display_name: clean || null }).eq('id', user.id);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: friendlyError(error, 'Could not save your name.') });
    await refreshProfile();
    setMsg({ ok: true, text: 'Name saved.' });
  };

  const logout = async () => {
    try { await signOut(); navigate('/'); } catch (e) { setMsg({ ok: false, text: friendlyError(e, 'Could not log out.') }); }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-extrabold">{isAnonymous ? 'Guest session' : 'Your account'}</h1>
      {isAnonymous && (
        <p className="panel p-4 text-sm text-muted">
          You are using a guest session that only keeps your likes on this device. <Link to="/signup" className="text-flame-soft underline">Create an account</Link> to keep them everywhere.
        </p>
      )}
      {params.get('denied') && (
        <p role="alert" className="panel border-flame-soft/50 p-4 text-sm">That page is for OnlyFap admins only.</p>
      )}
      <section className="panel space-y-4 p-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Email</dt><dd className="break-all">{user?.email}</dd>
          <dt className="text-muted">Role</dt><dd className="capitalize">{profile?.role ?? 'user'}</dd>
          <dt className="text-muted">Member since</dt><dd>{profile ? formatDate(profile.created_at) : '—'}</dd>
        </dl>
        <form onSubmit={save} className="space-y-2">
          <label htmlFor="dn" className="label">Display name</label>
          <div className="flex gap-2">
            <input id="dn" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary shrink-0" disabled={busy}>{busy ? 'Saving…' : 'Save name'}</button>
          </div>
          {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-mint' : 'text-[#ff8fb6]'}`}>{msg.text}</p>}
        </form>
      </section>
      {isAdmin && (
        <section className="panel p-6">
          <h2 className="mb-3 text-xl font-bold">Admin tools</h2>
          <div className="flex flex-wrap gap-2">
            {ADMIN_LINKS.map((l) => <Link key={l.to} to={l.to} className="btn-ghost">{l.label}</Link>)}
          </div>
        </section>
      )}
      <section className="panel space-y-3 p-6">
        <h2 className="text-xl font-bold">Privacy &amp; safety</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/liked" className="btn-ghost">Liked posts</Link>
          <button type="button" className="btn-ghost" onClick={() => { revokeAgeAcceptance(); navigate('/'); }}>Reset age confirmation</button>
          <Link to="/legal/privacy" className="btn-ghost">Privacy Policy</Link>
        </div>
        <p className="text-xs text-muted">To delete your account, contact us via the <Link to="/legal/contact" className="underline">contact page</Link>.</p>
      </section>
      <button onClick={logout} className="btn-danger">{isAnonymous ? 'End guest session' : 'Log out'}</button>
    </div>
  );
}
