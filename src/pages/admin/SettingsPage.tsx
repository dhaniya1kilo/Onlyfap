import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { getSettings, listSearchQueries, saveSettings, setSearchQueryBlocked, type SearchQueryRow, type SiteSettings } from '../../services/adminService';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ErrorState, Spinner } from '../../components/ui/States';
import { friendlyError } from '../../lib/errors';
import { FEATURES, LEGAL, SITE } from '../../lib/site';
import { getAgeProvider } from '../../lib/ageVerification';
import { LEGAL_DRAFT } from '../../content/legal';
import { formatDate } from '../../utils/format';

function Status({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex gap-3 py-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-label="Configured" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-flame-soft" aria-label="Not configured" />}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </li>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings', true);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [queries, setQueries] = useState<SearchQueryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setError(null);
    getSettings().then(setSettings).catch((e) => setError(friendlyError(e, 'Could not load settings.')));
    listSearchQueries(40).then(setQueries).catch(() => setQueries([]));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!settings || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveSettings(settings);
      setMsg({ ok: true, text: 'Settings saved.' });
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'Could not save settings.') });
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async (q: SearchQueryRow) => {
    try {
      await setSearchQueryBlocked(q.id, !q.is_blocked);
      setQueries((list) => list?.map((x) => (x.id === q.id ? { ...x, is_blocked: !q.is_blocked } : x)) ?? null);
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'Could not update that search.') });
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return <Spinner label="Loading settings" />;
  const provider = getAgeProvider();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold">Settings</h1>

      <section className="panel space-y-4 p-5">
        <h2 className="text-lg font-bold">Moderation automation</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#E11D48]" checked={settings.auto_hide_urgent_requests}
            onChange={(e) => setSettings({ ...settings, auto_hide_urgent_requests: e.target.checked })} />
          <span>
            <strong>Hide content while an urgent removal request is reviewed.</strong>
            <span className="block text-muted">Urgent = person depicted, consent issue, or possible minor. Content is hidden, never deleted; you can restore it after review. Off by default because anyone can submit a request.</span>
          </span>
        </label>
        <div>
          <label htmlFor="thr" className="label">Auto-hide after this many serious reports (0 = off)</label>
          <input id="thr" type="number" min={0} max={50} className="input max-w-[8rem]" value={settings.auto_hide_report_threshold}
            onChange={(e) => setSettings({ ...settings, auto_hide_report_threshold: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
          <p className="mt-1 text-xs text-muted">Counts open reports from different browsers in serious categories (minor, non-consensual, illegal, violence).</p>
        </div>
        {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-mint' : 'text-danger'}`}>{msg.text}</p>}
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </section>

      <section className="panel p-5">
        <h2 className="mb-2 text-lg font-bold">Configuration status</h2>
        <p className="mb-2 text-xs text-muted">Read from this build’s public environment. Secrets are never visible here.</p>
        <ul className="divide-y divide-ink-line">
          <Status ok={!SITE.origin.includes('localhost')} label={`Site URL: ${SITE.origin}`} hint="VITE_SITE_URL — used for canonical links, sharing and sitemap." />
          <Status ok={FEATURES.emailFunction} label="Email notifications" hint="VITE_EMAIL_FUNCTION_ENABLED=true after deploying the removal-email Edge Function with an email provider key." />
          <Status ok={provider.isFormalVerification} label={`Age check: ${provider.label}`} hint="Self-declaration is not formal age verification. Integrate a provider where the law requires it (see src/lib/ageVerification.ts)." />
          <Status ok={FEATURES.anonymousLikes} label="Guest likes" hint="VITE_ENABLE_ANONYMOUS_LIKES=true plus Anonymous sign-ins enabled in Supabase Auth. Off = likes need an account." />
          <Status ok={Boolean(LEGAL.entity && LEGAL.email && LEGAL.address)} label="Legal entity details" hint="VITE_LEGAL_ENTITY_NAME, VITE_BUSINESS_ADDRESS, VITE_CONTACT_EMAIL fill the legal page placeholders." />
          <Status ok={!LEGAL_DRAFT} label={LEGAL_DRAFT ? 'Legal pages are marked DRAFT' : 'Legal pages published'} hint="Have them reviewed by a qualified lawyer, then set LEGAL_DRAFT = false in src/content/legal.tsx." />
        </ul>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="text-lg font-bold">Popular searches</h2>
        <p className="text-xs text-muted">Anonymous counts only. Searches appear as suggestions after 3+ searches with results. Block anything inappropriate.</p>
        {queries === null ? <Spinner label="Loading" /> : queries.length === 0 ? <p className="text-sm text-muted">No searches recorded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-muted"><tr><th className="p-2 font-medium">Query</th><th className="p-2 font-medium">Searches</th><th className="p-2 font-medium">Results</th><th className="p-2 font-medium">Last</th><th className="p-2"><span className="sr-only">Action</span></th></tr></thead>
              <tbody className="divide-y divide-ink-line">
                {queries.map((q) => (
                  <tr key={q.id} className={q.is_blocked ? 'opacity-50' : ''}>
                    <td className="p-2">{q.query}</td>
                    <td className="p-2 text-muted">{q.search_count.toLocaleString()}</td>
                    <td className="p-2 text-muted">{q.result_count ?? '—'}</td>
                    <td className="p-2 text-muted">{formatDate(q.last_searched_at)}</td>
                    <td className="p-2 text-right"><button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => void toggleBlock(q)}>{q.is_blocked ? 'Unblock' : 'Block'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
