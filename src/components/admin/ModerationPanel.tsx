import { useCallback, useEffect, useState } from 'react';
import type { ModerationAction, ModerationState } from '../../types';
import { listModerationActions, setContentState } from '../../services/moderationService';
import { MODERATION_STATES } from '../../lib/labels';
import { friendlyError } from '../../lib/errors';
import { formatDateTime } from '../../utils/format';

/** Change a post's moderation state (with a logged note) and see its history. */
export function ModerationPanel({
  contentId,
  state,
  requestId,
  onChanged,
}: {
  contentId: string;
  state: ModerationState;
  requestId?: string;
  onChanged?: (s: ModerationState) => void;
}) {
  const [value, setValue] = useState<ModerationState>(state);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [log, setLog] = useState<ModerationAction[] | null>(null);

  useEffect(() => setValue(state), [state]);
  const loadLog = useCallback(() => {
    listModerationActions({ contentId }, 20).then(setLog).catch(() => setLog([]));
  }, [contentId]);
  useEffect(loadLog, [loadLog]);

  const save = async () => {
    if (busy || value === state) return;
    setBusy(true);
    setMsg(null);
    try {
      await setContentState(contentId, value, note, requestId);
      setNote('');
      setMsg({ ok: true, text: 'Visibility updated and logged.' });
      onChanged?.(value);
      loadLog();
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'Could not update visibility.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="mod-h">
      <h2 id="mod-h" className="text-lg font-bold">Moderation</h2>
      <fieldset className="grid gap-1.5 sm:grid-cols-2">
        <legend className="label">Visibility</legend>
        {MODERATION_STATES.map((s) => (
          <label key={s.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${value === s.value ? 'border-flame-soft bg-flame/10' : 'border-ink-line hover:bg-ink-3'}`}>
            <input type="radio" name={`mod-${contentId}`} checked={value === s.value} onChange={() => setValue(s.value)} className="h-4 w-4 accent-[#E11D48]" />
            {s.label}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={`mod-note-${contentId}`} className="label">Internal note (logged, never public)</label>
        <input id={`mod-note-${contentId}`} className="input" maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this change?" />
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-mint' : 'text-danger'}`}>{msg.text}</p>}
      <button type="button" className="btn-primary" disabled={busy || value === state} onClick={save}>{busy ? 'Saving…' : 'Apply'}</button>

      <div>
        <h3 className="mb-2 text-sm font-semibold">History</h3>
        {log === null ? <p className="text-xs text-muted">Loading…</p> : log.length === 0 ? <p className="text-xs text-muted">No moderation actions yet.</p> : (
          <ul className="space-y-1.5 text-xs text-muted">
            {log.map((a) => (
              <li key={a.id}>
                <span className="text-fg">{formatDateTime(a.created_at)}</span> — {a.action.replace('_', ' ')}
                {a.from_value || a.to_value ? `: ${a.from_value ?? '—'} → ${a.to_value ?? '—'}` : ''}
                {a.note ? ` · “${a.note}”` : ''}
                {!a.actor_id && ' · automatic'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
