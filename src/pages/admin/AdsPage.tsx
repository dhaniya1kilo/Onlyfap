import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Ad, AdType } from '../../types';
import { createAd, deleteAd, listAllAds, updateAd } from '../../services/adService';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { isSafeHttpUrl, formatDate } from '../../utils/format';
import { AdSlot } from '../../components/feed/AdSlot';
import { ErrorState, Spinner } from '../../components/ui/States';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const TYPE_HELP: Record<AdType, string> = {
  link: 'A destination URL. Shown as a simple sponsored link card.',
  html: 'Advertiser HTML. Runs inside an isolated sandbox with no access to the site or user accounts.',
  embed: 'An advertiser embed snippet (script or iframe). Also runs inside the isolated sandbox.',
};

interface Draft { id?: string; ad_type: AdType; label: string; ad_content: string; is_active: boolean }
const EMPTY: Draft = { ad_type: 'link', label: '', ad_content: '', is_active: true };

export default function AdsPage() {
  useDocumentTitle('Advertisements', true);
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    listAllAds().then(setAds).catch((e) => setLoadError(friendlyError(e, 'Could not load ads.')));
  }, []);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    if (busy) return false;
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ ok: true, text: ok });
      load();
      return true;
    } catch (e) {
      setNotice({ ok: false, text: friendlyError(e, 'That change could not be saved.') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.ad_content.trim();
    if (!content) return setNotice({ ok: false, text: 'Add the ad content.' });
    if (draft.ad_type === 'link' && !isSafeHttpUrl(content)) return setNotice({ ok: false, text: 'Enter a full URL starting with https://' });
    if (!user) return;
    const input = { ad_type: draft.ad_type, label: draft.label.trim() || null, ad_content: content, is_active: draft.is_active };
    const ok = await act(
      () => (draft.id ? updateAd(draft.id, input) : createAd(user.id, input)),
      draft.id ? 'Ad saved.' : 'Ad created.',
    );
    if (ok) setDraft(EMPTY);
  };

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Advertisements</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">Active ads appear after every 5 posts in the feed and search results, rotating in order.</p>
      </div>

      <form onSubmit={submit} className="panel max-w-2xl space-y-4 p-5">
        <h2 className="text-xl font-bold">{draft.id ? 'Edit ad' : 'New ad'}</h2>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="label">Type</legend>
          {(['link', 'html', 'embed'] as AdType[]).map((t) => (
            <label key={t} className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium ${draft.ad_type === t ? 'bg-flame text-white' : 'bg-ink-3'}`}>
              <input type="radio" name="ad_type" value={t} className="sr-only" checked={draft.ad_type === t} onChange={() => setDraft({ ...draft, ad_type: t })} />
              {t === 'html' ? 'HTML' : t === 'embed' ? 'Embed code' : 'Link'}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted">{TYPE_HELP[draft.ad_type]}</p>
        <div>
          <label htmlFor="ad-label" className="label">Label (optional)</label>
          <input id="ad-label" className="input" maxLength={120} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Shown on link ads and to screen readers" />
        </div>
        <div>
          <label htmlFor="ad-content" className="label">{draft.ad_type === 'link' ? 'URL' : 'Code'}</label>
          {draft.ad_type === 'link' ? (
            <input id="ad-content" type="url" className="input" value={draft.ad_content} onChange={(e) => setDraft({ ...draft, ad_content: e.target.value })} placeholder="https://" />
          ) : (
            <textarea id="ad-content" rows={6} className="input font-mono text-xs" maxLength={20000} value={draft.ad_content} onChange={(e) => setDraft({ ...draft, ad_content: e.target.value })} />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#E11D48]" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
          Active
        </label>
        {notice && <p role="status" className={`text-sm ${notice.ok ? 'text-mint' : 'text-[#ff8fb6]'}`}>{notice.text}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : draft.id ? 'Save ad' : 'Create ad'}</button>
          {draft.id && <button type="button" className="btn-ghost" onClick={() => setDraft(EMPTY)}>Cancel</button>}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">All ads</h2>
        {!ads ? <Spinner label="Loading ads" /> : ads.length === 0 ? (
          <p className="text-sm text-muted">No ads yet. The feed shows posts only until you add one.</p>
        ) : (
          <ul className="space-y-3">
            {ads.map((ad) => (
              <li key={ad.id} className="panel space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ad.is_active ? 'bg-mint/25 text-mint' : 'bg-ink-3 text-muted'}`}>
                    {ad.is_active ? 'Active' : 'Paused'}
                  </span>
                  <span className="text-sm font-medium uppercase">{ad.ad_type}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{ad.label || ad.ad_content.slice(0, 80)}</span>
                  <span className="text-xs text-muted">{formatDate(ad.updated_at)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => act(() => updateAd(ad.id, { is_active: !ad.is_active }), ad.is_active ? 'Ad paused.' : 'Ad activated.')}>
                    {ad.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn-ghost px-3 py-1 text-xs" onClick={() => { setDraft({ id: ad.id, ad_type: ad.ad_type, label: ad.label ?? '', ad_content: ad.ad_content, is_active: ad.is_active }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                  <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setPreviewId(previewId === ad.id ? null : ad.id)}>{previewId === ad.id ? 'Hide preview' : 'Preview'}</button>
                  <button className="btn-danger px-3 py-1 text-xs" disabled={busy} onClick={() => window.confirm('Delete this ad?') && void act(() => deleteAd(ad.id), 'Ad deleted.')}>Delete</button>
                </div>
                {previewId === ad.id && <AdSlot ad={ad} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
