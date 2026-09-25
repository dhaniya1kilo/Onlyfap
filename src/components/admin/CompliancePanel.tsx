import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ContentCompliance } from '../../types';
import { getCompliance, saveCompliance } from '../../services/moderationService';
import { friendlyError } from '../../lib/errors';
import { formatDateTime } from '../../utils/format';

type Draft = Omit<ContentCompliance, 'verified_by' | 'verified_at' | 'updated_at'>;

const empty = (contentId: string): Draft => ({
  content_id: contentId,
  consent_status: 'unknown',
  age_verification_status: 'unverified',
  ownership_basis: 'unknown',
  performer_count: null,
  records_reference: null,
  custodian_note: null,
});

/**
 * Compliance record POINTERS for one post (admin only). This stores the
 * status of consent / age-verification / ownership records and WHERE the
 * custodian keeps them. Never paste or upload ID documents here.
 */
export function CompliancePanel({ contentId }: { contentId: string }) {
  const [draft, setDraft] = useState<Draft>(empty(contentId));
  const [meta, setMeta] = useState<ContentCompliance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    getCompliance(contentId)
      .then((c) => {
        if (!live) return;
        setMeta(c);
        if (c) {
          setDraft({
            content_id: c.content_id,
            consent_status: c.consent_status,
            age_verification_status: c.age_verification_status,
            ownership_basis: c.ownership_basis,
            performer_count: c.performer_count,
            records_reference: c.records_reference,
            custodian_note: c.custodian_note,
          });
        }
        setLoaded(true);
      })
      .catch(() => live && setLoaded(true));
    return () => { live = false; };
  }, [contentId]);

  const complete = draft.consent_status === 'documented' && draft.age_verification_status === 'verified';

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveCompliance(
        { ...draft, records_reference: draft.records_reference?.trim() || null, custodian_note: draft.custodian_note?.trim() || null },
        complete,
      );
      setMsg({ ok: true, text: 'Compliance record saved.' });
      setMeta(await getCompliance(contentId));
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'Could not save the compliance record.') });
    } finally {
      setBusy(false);
    }
  };

  const sel = 'input py-2';
  return (
    <section className="panel space-y-4 p-5" aria-labelledby="comp-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="comp-h" className="text-lg font-bold">Compliance records</h2>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${complete ? 'bg-mint/15 text-mint' : 'bg-flame/15 text-flame-soft'}`}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {complete ? 'Consent & age recorded' : 'Incomplete'}
        </span>
      </div>
      <p className="text-xs text-muted">
        Record the status of consent and age/identity records for everyone depicted, and a reference to where the custodian of records keeps them.
        Do not upload or paste identity documents here or into the media library.
      </p>
      {!loaded ? <p className="text-sm text-muted">Loading…</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-consent" className="label">Consent documentation</label>
            <select id="c-consent" className={sel} value={draft.consent_status} onChange={(e) => setDraft({ ...draft, consent_status: e.target.value as Draft['consent_status'] })}>
              <option value="unknown">Unknown</option>
              <option value="documented">Documented for all people depicted</option>
              <option value="missing">Missing</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>
          <div>
            <label htmlFor="c-age" className="label">Age / identity verification</label>
            <select id="c-age" className={sel} value={draft.age_verification_status} onChange={(e) => setDraft({ ...draft, age_verification_status: e.target.value as Draft['age_verification_status'] })}>
              <option value="unverified">Not verified</option>
              <option value="verified">Verified 18+ for all people depicted</option>
              <option value="failed">Failed / could not verify</option>
            </select>
          </div>
          <div>
            <label htmlFor="c-own" className="label">Ownership basis</label>
            <select id="c-own" className={sel} value={draft.ownership_basis} onChange={(e) => setDraft({ ...draft, ownership_basis: e.target.value as Draft['ownership_basis'] })}>
              <option value="unknown">Unknown</option>
              <option value="owned">Owned by the operator</option>
              <option value="licensed">Licensed</option>
              <option value="performer_submitted">Submitted by the performer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="c-count" className="label">People depicted</label>
            <input id="c-count" type="number" min={0} max={50} className="input" value={draft.performer_count ?? ''}
              onChange={(e) => setDraft({ ...draft, performer_count: e.target.value === '' ? null : Math.max(0, Math.min(50, Number(e.target.value))) })} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="c-ref" className="label">Records reference</label>
            <input id="c-ref" className="input" maxLength={500} value={draft.records_reference ?? ''} onChange={(e) => setDraft({ ...draft, records_reference: e.target.value })}
              placeholder="e.g. custodian file ID / location — not the documents themselves" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="c-note" className="label">Custodian note</label>
            <textarea id="c-note" rows={2} className="input" maxLength={2000} value={draft.custodian_note ?? ''} onChange={(e) => setDraft({ ...draft, custodian_note: e.target.value })} />
          </div>
        </div>
      )}
      {meta?.verified_at && <p className="text-xs text-muted">Last marked complete: {formatDateTime(meta.verified_at)}</p>}
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-mint' : 'text-danger'}`}>{msg.text}</p>}
      <button type="button" className="btn-primary" onClick={save} disabled={busy || !loaded}>{busy ? 'Saving…' : 'Save compliance record'}</button>
    </section>
  );
}
