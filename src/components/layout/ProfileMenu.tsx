import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';

export const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/upload', label: 'Upload' },
  { to: '/admin/tags', label: 'Tags' },
  { to: '/admin/ads', label: 'Ads' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/removal-requests', label: 'Removal requests' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/settings', label: 'Settings' },
];

export function ProfileMenu() {
  const { user, profile, isAdmin, isAnonymous, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const logout = async () => {
    try {
      await signOut();
      close();
      navigate('/');
    } catch (e) {
      setErr(friendlyError(e, 'Could not log out. Try again.'));
    }
  };

  const item = 'block rounded-lg px-3 py-2 text-sm hover:bg-ink-3';
  const signedIn = user && !isAnonymous;

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-line bg-ink-2 hover:border-flame-soft"
      >
        {signedIn ? (
          <span className="font-display font-bold text-flame-soft">{(profile?.display_name || user.email || '?').slice(0, 1).toUpperCase()}</span>
        ) : (
          <UserRound className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div role="menu" className="panel absolute right-0 z-50 mt-2 max-h-[80vh] w-60 overflow-y-auto p-2 shadow-2xl shadow-black/40">
          {!signedIn ? (
            <>
              {isAnonymous && <p className="px-3 pb-2 pt-1 text-xs text-muted">Guest session — your likes are saved on this device only.</p>}
              <Link role="menuitem" to="/login" onClick={close} className={item}>Log in</Link>
              <Link role="menuitem" to="/signup" onClick={close} className={item}>Sign up</Link>
              <Link role="menuitem" to="/liked" onClick={close} className={item}>Liked</Link>
              {isAnonymous && <button role="menuitem" onClick={logout} className={`${item} w-full text-left text-danger`}>End guest session</button>}
            </>
          ) : (
            <>
              <div className="border-b border-ink-line px-3 pb-2 pt-1">
                <p className="truncate text-sm font-semibold">{profile?.display_name || 'Your account'}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <Link role="menuitem" to="/account" onClick={close} className={`${item} mt-1`}>Account</Link>
              <Link role="menuitem" to="/liked" onClick={close} className={item}>Liked</Link>
              {isAdmin && (
                <div className="my-1 border-t border-ink-line pt-1">
                  <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Admin</p>
                  {ADMIN_LINKS.map((l) => (
                    <Link key={l.to} role="menuitem" to={l.to} onClick={close} className={item}>{l.label}</Link>
                  ))}
                </div>
              )}
              <button role="menuitem" onClick={logout} className={`${item} w-full text-left text-danger`}>Log out</button>
            </>
          )}
          {err && <p className="px-3 py-1 text-xs text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}
