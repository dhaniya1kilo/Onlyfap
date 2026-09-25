import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import type { ContentItem, ModerationAction, RemovalRequest, RemovalResolution, RemovalStatus } from '../../types';
import {
  getRemovalRequest,
  listModerationActions,
  listRemovalRequests,
  setContentState,
  updateRemovalRequest,
} from '../../services/moderationService';
import { deleteContent, fetchContentById } from '../../services/contentService';
import { removeMedia } from '../../services/storageService';
import { sendAdminResponse } from '../../services/emailService';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { MediaView } from '../../components/media/MediaView';
import { ListFooter } from '../../components/ui/ListFooter';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { friendlyError } from '../../lib/errors';
import { FEATURES } from '../../lib/site';
import { PRIORITY_STYLE, REMOVAL_REASONS, REMOVAL_STATUSES, RESOLUTIONS, labelOf } from '../../lib/labels';
import { formatDateTime, timeAgo } from '../../utils/format';

type Filter = RemovalStatus | 'open' | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export default function RemovalRequestsPage() {
  useDocumentTitle('Removal requests', true);
  const { id } = useParams();
  const [filter, setFilter] = useState<Filter>('open');
  const fetchPage = useCallback((o: number, l: number) => listRemovalRequests(filter, o, l), [filter]);
  const list = useInfiniteList(fetchPage, `rr|${filter}`, 25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Removal requests</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Requests are never acted on automatically. Review each one, decide, record the outcome and reply to the requester. Urgent = consent,
          person depicted or possible minor.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className={`space-y-4 ${id ? 'hidden xl:block' : ''}`}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)} className={`pill py-1 text-[13px] ${filter === f.value ? 'pill-on' : 'pill-off'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {!list.initialized && <Spinner label="Loading requests" />}
          {list.initialized && list.error && list.items.length === 0 && <ErrorState message={list.error} onRetry={list.loadMore} />}
          {list.initialized && !list.error && list.items.length === 0 && <EmptyState title="No requests here" />}
          {list.items.length > 0 && (
            <ul className="panel divide-y divide-ink-line">
              {list.items.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/admin/removal-requests/${r.id}`}
                    aria-current={r.id === id ? 'true' : undefined}
                    className={`block space-y-1 p-3 hover:bg-ink-3 ${r.id === id ? 'bg-ink-3' : ''}`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</span>
                      <span className="font-mono text-muted">{r.reference}</span>
                      <span className="ml-auto text-muted">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="truncate text-sm font-medium">{labelOf(REMOVAL_REASONS, r.reason)}</p>
                    <p className="truncate text-xs text-muted">{r.status} · {r.content_snapshot?.title ?? r.content_url ?? 'Unknown content'}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {list.initialized && list.items.length > 0 && (
            <ListFooter loading={list.loading} error={list.error} hasMore={list.hasMore} count={list.items.length} onMore={list.loadMore} endText="No more requests." />
          )}
        </div>
        <div className={id ? '' : 'hidden xl:block'}>
          {id ? <RequestDetail key={id} id={id} onChanged={list.reload} /> : (
            <div className="panel flex min-h-60 items-center justify-center p-6 text-sm text-muted">Select a request to review it.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const navigate = useNavigate();
  const [req, setReq] = useState<RemovalRequest | null | undefined>(undefined);
  const [content, setContent] = useState<ContentItem | null>(null);
  const [log, setLog] = useState<ModerationAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RemovalStatus>('pending');
  const [resolution, setResolution] = useState<RemovalResolution | ''>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [subject, setSubject] = useState('');
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await getRemovalRequest(id);
      if (!r) return setReq(null);
      // Load everything first so the page never flashes "content no longer exists".
      const [c, actions] = await Promise.all([
        r.content_id ? fetchContentById(r.content_id).catch(() => null) : Promise.resolve(null),
        listModerationActions({ requestId: r.id, contentId: r.content_id ?? undefined }, 30).catch(() => [] as ModerationAction[]),
      ]);
      setContent(c);
      setLog(actions);
      setStatus(r.status);
      setResolution(r.resolution ?? '');
      setNotes(r.admin_notes ?? '');
      setSubject((s) => s || `Your removal request ${r.reference}`);
      setReq(r);
    } catch (e) {
      setError(friendlyError(e, 'Could not load this request.'));
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    if (busy) return;
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await load();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'That action failed.') });
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (req === undefined) return <Spinner label="Loading request" />;
  if (req === null) return <EmptyState title="Request not found" />;

  const saveStatus = () =>
    run('save', () => updateRemovalRequest(req.id, { status, resolution: resolution || null, admin_notes: notes.trim() || null }), 'Request updated.');

  const hide = () =>
    run('hide', async () => {
      if (!content) return;
      await setContentState(content.id, 'hidden', `Removal request ${req.reference}`, req.id);
      if (req.status === 'pending') await updateRemovalRequest(req.id, { status: 'reviewing' });
    }, 'Content hidden from the public.');

  const restore = () =>
    run('restore', async () => {
      if (!content) return;
      await setContentState(content.id, 'active', `Restored after review of ${req.reference}`, req.id);
    }, 'Content is visible again.');

  const remove = () => {
    if (!content) return;
    if (!window.confirm('Permanently delete this content and its files? The request keeps a snapshot of the title.')) return;
    void run('delete', async () => {
      const paths = await deleteContent(content.id);
      await Promise.all(paths.map((p) => removeMedia(p)));
      await updateRemovalRequest(req.id, { status: 'resolved', resolution: 'content_removed', admin_notes: notes.trim() || null });
    }, 'Content deleted and request resolved.');
  };

  const sendReply = () =>
    run('email', async () => {
      const res = await sendAdminResponse(req.id, subject.trim(), reply.trim());
      if (!res.sent) {
        throw new Error(
          res.reason === 'disabled' || res.reason === 'not_configured'
            ? 'Email sending is not configured, so nothing was sent. Use “Reply from your mail app” instead.'
            : `The email was not sent${res.message ? ` (${res.message})` : ''}.`,
        );
      }
      setReply('');
    }, 'Email sent to the requester.');

  const mailto = `mailto:${encodeURIComponent(req.email)}?subject=${encodeURIComponent(subject || req.reference)}&body=${encodeURIComponent(reply)}`;
  const urgent = req.priority === 'urgent';

  return (
    <article className="space-y-5">
      <button type="button" className="btn-ghost xl:hidden" onClick={() => navigate('/admin/removal-requests')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All requests
      </button>

      <header className="panel space-y-2 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${PRIORITY_STYLE[req.priority]}`}>{req.priority}</span>
          <span className="rounded-full bg-ink-3 px-2 py-0.5 font-semibold">{req.status}</span>
          <span className="font-mono text-muted">{req.reference}</span>
          <span className="ml-auto text-muted">Received {formatDateTime(req.created_at)}</span>
        </div>
        <h2 className="text-xl font-bold">{labelOf(REMOVAL_REASONS, req.reason)}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="break-all"><a className="text-flame-soft underline" href={`mailto:${req.email}`}>{req.email}</a></dd>
          <dt className="text-muted">Name</dt><dd>{req.name || '—'}</dd>
          <dt className="text-muted">Good-faith statement</dt><dd>{req.good_faith_confirmed ? 'Confirmed' : 'Not confirmed'}</dd>
          <dt className="text-muted">Acknowledgement email</dt><dd>{req.ack_sent_at ? `Sent ${formatDateTime(req.ack_sent_at)}` : 'Not sent'}</dd>
          <dt className="text-muted">Last reply</dt><dd>{req.last_response_at ? formatDateTime(req.last_response_at) : '—'}</dd>
        </dl>
      </header>

      {req.reason === 'underage_concern' && (
        <div role="note" className="flex gap-3 rounded-xl border border-flame/60 bg-flame/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-flame-soft" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Possible minor — act immediately</p>
            <p className="text-muted">
              Hide the content now. Do not download or share it. Preserve records as your counsel advises and report to the authorities where required
              (e.g. NCMEC CyberTipline in the US, IWF in the UK, or local law enforcement).
            </p>
          </div>
        </div>
      )}

      <section className="panel space-y-3 p-5">
        <h3 className="font-semibold">Details from the requester</h3>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed">{req.details}</p>
        {req.additional_info && (
          <>
            <h4 className="pt-2 text-sm font-semibold">Additional information</h4>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-fg/90">{req.additional_info}</p>
          </>
        )}
        {req.content_url && <p className="break-all text-xs text-muted">Link given: {req.content_url}</p>}
      </section>

      <section className="panel space-y-3 p-5">
        <h3 className="font-semibold">Affected content</h3>
        {content ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-ink-3 sm:w-48"><MediaView item={content} variant="thumb" /></div>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <p className="font-semibold">{content.title}</p>
              <p className="text-xs text-muted">
                State: <strong className="text-fg">{content.is_published ? content.moderation_state.replace('_', ' ') : 'unpublished'}</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to={`/content/${content.id}`} className="btn-ghost px-3 py-1.5 text-xs"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open</Link>
                <Link to={`/admin/content/${content.id}/edit`} className="btn-ghost px-3 py-1.5 text-xs">Edit / compliance</Link>
                {content.moderation_state === 'hidden' || content.moderation_state === 'removed' ? (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={restore} disabled={!!busy}>Restore visibility</button>
                ) : (
                  <button type="button" className={`${urgent ? 'btn-primary' : 'btn-ghost'} px-3 py-1.5 text-xs`} onClick={hide} disabled={!!busy}>Hide now</button>
                )}
                <button type="button" className="btn-danger px-3 py-1.5 text-xs" onClick={remove} disabled={!!busy}>Delete permanently</button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {req.content_id ? 'This content no longer exists.' : 'No post was linked; check the link above.'}
            {req.content_snapshot?.title && <> Snapshot title: <span className="text-fg">“{req.content_snapshot.title}”</span></>}
          </p>
        )}
      </section>

      <section className="panel space-y-4 p-5">
        <h3 className="font-semibold">Decision</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rr-status" className="label">Status</label>
            <select id="rr-status" className="input py-2" value={status} onChange={(e) => setStatus(e.target.value as RemovalStatus)}>
              {REMOVAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rr-res" className="label">Outcome</label>
            <select id="rr-res" className="input py-2" value={resolution} onChange={(e) => setResolution(e.target.value as RemovalResolution | '')}>
              <option value="">Not decided</option>
              {RESOLUTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="rr-notes" className="label">Internal notes <span className="font-normal text-muted">(admins only — never shown or emailed to the requester)</span></label>
          <textarea id="rr-notes" rows={4} className="input" maxLength={10000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" onClick={saveStatus} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save decision'}</button>
      </section>

      <section className="panel space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4" aria-hidden="true" /> Reply to the requester</h3>
        {!FEATURES.emailFunction && (
          <p className="rounded-xl bg-ink-3 p-3 text-xs text-muted">
            Sending from the site is not configured (see README → Email). Write your reply here and use “Reply from your mail app”.
          </p>
        )}
        <div>
          <label htmlFor="rr-subj" className="label">Subject</label>
          <input id="rr-subj" className="input" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rr-msg" className="label">Message</label>
          <textarea id="rr-msg" rows={5} className="input" maxLength={5000} value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder={`Hello,\n\nThank you for your request ${req.reference}. …`} />
        </div>
        <div className="flex flex-wrap gap-2">
          {FEATURES.emailFunction && (
            <button type="button" className="btn-primary" onClick={sendReply} disabled={!!busy || reply.trim().length < 5}>
              {busy === 'email' ? 'Sending…' : 'Send email'}
            </button>
          )}
          <a className="btn-ghost" href={mailto}>Reply from your mail app</a>
        </div>
      </section>

      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-mint' : 'text-danger'}`}>{msg.text}</p>}

      <section className="space-y-2">
        <h3 className="font-semibold">Activity</h3>
        {log.length === 0 ? <p className="text-xs text-muted">No actions yet.</p> : (
          <ul className="space-y-1.5 text-xs text-muted">
            {log.map((a) => (
              <li key={a.id}>
                <span className="text-fg">{formatDateTime(a.created_at)}</span> — {a.action.replace('_', ' ')}
                {a.from_value || a.to_value ? `: ${a.from_value ?? '—'} → ${a.to_value ?? '—'}` : ''}
                {a.note ? ` · ${a.note}` : ''}
                {!a.actor_id && ' · automatic'}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
