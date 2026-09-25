import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReportStatus } from '../../types';
import { listReports, setContentState, updateReport } from '../../services/moderationService';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ListFooter } from '../../components/ui/ListFooter';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { friendlyError } from '../../lib/errors';
import { REPORT_REASONS, REPORT_STATUSES, labelOf } from '../../lib/labels';
import { formatDateTime } from '../../utils/format';

const SERIOUS = new Set(['underage_concern', 'non_consensual', 'illegal', 'violence']);

export default function ReportsPage() {
  useDocumentTitle('Reports', true);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const fetchPage = useCallback((o: number, l: number) => listReports(filter, o, l), [filter]);
  const list = useInfiniteList(fetchPage, `reports|${filter}`, 30);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (id: string, fn: () => Promise<void>, ok: string, status?: ReportStatus) => {
    if (busy) return;
    setBusy(id);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      if (status) list.updateLocal(id, { status });
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e, 'That action failed.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Reports</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">Anonymous quick reports from viewers. Serious categories put the post “under review” automatically (it stays visible unless you hide it or enable auto-hide in Settings).</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {[{ value: 'all' as const, label: 'All' }, ...REPORT_STATUSES].map((f) => (
          <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)} className={`pill py-1 text-[13px] ${filter === f.value ? 'pill-on' : 'pill-off'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-mint' : 'text-danger'}`}>{msg.text}</p>}
      {!list.initialized && <Spinner label="Loading reports" />}
      {list.initialized && list.error && list.items.length === 0 && <ErrorState message={list.error} onRetry={list.loadMore} />}
      {list.initialized && !list.error && list.items.length === 0 && <EmptyState title="No reports here" />}
      {list.items.length > 0 && (
        <ul className="panel divide-y divide-ink-line">
          {list.items.map((r) => (
            <li key={r.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${SERIOUS.has(r.reason) ? 'bg-flame text-white' : 'bg-ink-3 text-muted'}`}>{labelOf(REPORT_REASONS, r.reason)}</span>
                <span className="rounded-full bg-ink-3 px-2 py-0.5">{r.status}</span>
                <span className="ml-auto text-muted">{formatDateTime(r.created_at)}</span>
              </div>
              <p className="text-sm">
                Post: {r.content_title ? <Link to={`/admin/content/${r.content_id}/edit`} className="text-flame-soft underline">{r.content_title}</Link> : <span className="text-muted">deleted</span>}
              </p>
              {r.details && <p className="whitespace-pre-line break-words text-sm text-fg/90">{r.details}</p>}
              <div className="flex flex-wrap gap-2">
                {r.content_title && (
                  <button type="button" className="btn-ghost px-3 py-1 text-xs" disabled={busy === r.id}
                    onClick={() => act(r.id, async () => { await setContentState(r.content_id, 'hidden', `Report ${r.id.slice(0, 8)}: ${r.reason}`); await updateReport(r.id, { status: 'actioned' }); }, 'Post hidden and report marked actioned.', 'actioned')}>
                    Hide post
                  </button>
                )}
                <button type="button" className="btn-ghost px-3 py-1 text-xs" disabled={busy === r.id}
                  onClick={() => act(r.id, () => updateReport(r.id, { status: 'reviewed' }), 'Marked reviewed.', 'reviewed')}>Mark reviewed</button>
                <button type="button" className="btn-ghost px-3 py-1 text-xs" disabled={busy === r.id}
                  onClick={() => act(r.id, () => updateReport(r.id, { status: 'dismissed' }), 'Report dismissed.', 'dismissed')}>Dismiss</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.initialized && list.items.length > 0 && (
        <ListFooter loading={list.loading} error={list.error} hasMore={list.hasMore} count={list.items.length} onMore={list.loadMore} endText="No more reports." />
      )}
    </div>
  );
}
