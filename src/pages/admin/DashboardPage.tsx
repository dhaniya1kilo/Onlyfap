import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { fetchDashboard } from '../../services/adminService';
import { friendlyError } from '../../lib/errors';
import { ErrorState, Spinner } from '../../components/ui/States';
import { MediaView } from '../../components/media/MediaView';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { compactNumber, timeAgo } from '../../utils/format';
import { REPORT_REASONS, labelOf } from '../../lib/labels';

type Data = Awaited<ReturnType<typeof fetchDashboard>>;

export default function DashboardPage() {
  useDocumentTitle('Admin dashboard', true);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchDashboard().then(setData).catch((e) => setError(friendlyError(e, 'Could not load dashboard numbers.')));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Spinner label="Loading dashboard" />;
  const s = data.stats;

  const cards = [
    { label: 'Total content', value: s.total_content, sub: `${s.public_content.toLocaleString()} public · ${s.hidden_content.toLocaleString()} hidden`, to: '/admin/content' },
    { label: 'Total views', value: s.total_views, sub: `${compactNumber(s.views_7d)} in the last 7 days`, to: '/admin/content' },
    { label: 'Total likes', value: s.total_likes, sub: `${compactNumber(s.likes_7d)} in the last 7 days`, to: '/admin/content' },
    { label: 'Active ads', value: s.active_ads, sub: 'Shown after every 5 posts', to: '/admin/ads' },
    { label: 'Pending removal requests', value: s.pending_removals, sub: `${s.urgent_removals} urgent`, to: '/admin/removal-requests', warn: s.urgent_removals > 0 },
    { label: 'Open reports', value: s.open_reports, sub: `${s.under_review} posts under review`, to: '/admin/reports', warn: s.open_reports > 0 },
    { label: 'Users', value: s.total_users, sub: `${s.total_tags} tags`, to: '/admin/users' },
    { label: 'Missing compliance records', value: s.missing_compliance, sub: 'Consent or age verification not recorded', to: '/admin/content', warn: s.missing_compliance > 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Dashboard</h1>
        <Link to="/admin/upload" className="btn-primary">Upload content</Link>
      </div>

      {s.urgent_removals > 0 && (
        <Link to="/admin/removal-requests" className="panel flex items-center gap-3 border-flame/60 bg-flame/10 p-4 text-sm hover:bg-flame/15">
          <AlertTriangle className="h-5 w-5 shrink-0 text-flame-soft" aria-hidden="true" />
          <span><strong>{s.urgent_removals} urgent removal request{s.urgent_removals === 1 ? '' : 's'}</strong> (consent, person depicted or possible minor) waiting for review.</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className={`panel p-4 hover:border-flame-soft ${c.warn ? 'border-flame/50' : ''}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{c.label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{c.value.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-muted">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Trending now</h2>
          {data.trending.length === 0 ? <p className="text-sm text-muted">No public content yet.</p> : (
            <ol className="panel divide-y divide-ink-line">
              {data.trending.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <span className="w-5 text-center font-display font-bold text-flame-soft">{i + 1}</span>
                  <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-ink-3"><MediaView item={c} variant="thumb" /></div>
                  <Link to={`/content/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-flame-soft">{c.title}</Link>
                  <span className="shrink-0 text-xs text-muted">{compactNumber(c.view_count)} views · {compactNumber(c.like_count)} likes</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Recent reports</h2>
          {data.reports.length === 0 ? <p className="text-sm text-muted">No reports.</p> : (
            <ul className="panel divide-y divide-ink-line">
              {data.reports.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'open' ? 'bg-flame/20 text-flame-soft' : 'bg-ink-3 text-muted'}`}>{r.status}</span>
                  <span className="min-w-0 flex-1 truncate">{labelOf(REPORT_REASONS, r.reason)} — <span className="text-muted">{r.content_title ?? 'deleted post'}</span></span>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/reports" className="text-sm text-flame-soft underline">All reports</Link>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Recent uploads</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted">No posts yet. <Link to="/admin/upload" className="text-flame-soft underline">Upload the first one</Link>.</p>
        ) : (
          <ul className="panel divide-y divide-ink-line">
            {data.recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-3"><MediaView item={c} variant="thumb" /></div>
                <div className="min-w-0 flex-1">
                  <Link to={`/content/${c.id}`} className="block truncate font-medium hover:text-flame-soft">{c.title}</Link>
                  <p className="text-xs text-muted">
                    {timeAgo(c.created_at)} · {compactNumber(c.view_count)} views · {compactNumber(c.like_count)} likes
                    {!c.is_published && ' · unpublished'}
                    {c.moderation_state !== 'active' && ` · ${c.moderation_state.replace('_', ' ')}`}
                  </p>
                </div>
                <Link to={`/admin/content/${c.id}/edit`} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Edit</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
