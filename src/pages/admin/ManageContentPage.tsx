import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ContentItem, ModerationState } from '../../types';
import { adminListContent, deleteContent, type AdminListParams } from '../../services/contentService';
import { setContentState } from '../../services/moderationService';
import { removeMedia } from '../../services/storageService';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { MediaView } from '../../components/media/MediaView';
import { ListFooter } from '../../components/ui/ListFooter';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { friendlyError } from '../../lib/errors';
import { compactNumber, formatDate } from '../../utils/format';

const FILTERS: { value: NonNullable<AdminListParams['state']>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'under_review', label: 'Under review' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
  { value: 'unpublished', label: 'Unpublished' },
];

const STATE_BADGE: Record<ModerationState, string> = {
  active: '',
  under_review: 'bg-velvet/25 text-[#DDD6FE]',
  hidden: 'bg-flame/20 text-flame-soft',
  removed: 'bg-flame text-white',
};

export default function ManageContentPage() {
  useDocumentTitle('Manage content', true);
  const [state, setState] = useState<NonNullable<AdminListParams['state']>>('all');
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const fetchPage = useCallback((o: number, l: number) => adminListContent(o, l, { state, query }), [state, query]);
  const list = useInfiniteList(fetchPage, `admin-content|${state}|${query}`, 20);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const remove = async (item: ContentItem) => {
    if (busy) return;
    if (!window.confirm(`Delete “${item.title}”? This permanently removes the post and its files. Consider hiding it instead if a request is still being reviewed.`)) return;
    setBusy(item.id);
    setNotice(null);
    try {
      const paths = await deleteContent(item.id);
      list.removeLocal(item.id);
      const cleaned = (await Promise.all(paths.map((p) => removeMedia(p)))).every(Boolean);
      setNotice({ ok: true, text: cleaned ? 'Post deleted.' : 'Post deleted. A file could not be removed from storage; delete it in Supabase Storage.' });
    } catch (e) {
      setNotice({ ok: false, text: friendlyError(e, 'Could not delete this post.') });
    } finally {
      setBusy(null);
    }
  };

  const toggleHidden = async (item: ContentItem) => {
    if (busy) return;
    const next: ModerationState = item.moderation_state === 'hidden' || item.moderation_state === 'removed' ? 'active' : 'hidden';
    setBusy(item.id);
    setNotice(null);
    try {
      await setContentState(item.id, next, next === 'hidden' ? 'Hidden from content manager' : 'Restored from content manager');
      setNotice({ ok: true, text: next === 'hidden' ? 'Post hidden from the public.' : 'Post is visible again.' });
      list.updateLocal(item.id, { moderation_state: next });
    } catch (e) {
      setNotice({ ok: false, text: friendlyError(e, 'Could not change visibility.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Content</h1>
        <Link to="/admin/upload" className="btn-primary">Upload content</Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search titles" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search titles" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by state">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={state === f.value} onClick={() => setState(f.value)} className={`pill py-1 text-[13px] ${state === f.value ? 'pill-on' : 'pill-off'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {notice && <p role="status" className={`text-sm ${notice.ok ? 'text-mint' : 'text-danger'}`}>{notice.text}</p>}
      {!list.initialized && <Spinner label="Loading posts" />}
      {list.initialized && list.error && list.items.length === 0 && <ErrorState message={list.error} onRetry={list.loadMore} />}
      {list.initialized && !list.error && list.items.length === 0 && <EmptyState title="No posts here">Try another filter, or upload a video or photo.</EmptyState>}
      {list.items.length > 0 && (
        <ul className="panel divide-y divide-ink-line">
          {list.items.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-ink-3 sm:h-16 sm:w-28">
                <MediaView item={c} variant="thumb" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Link to={`/content/${c.id}`} className="block truncate font-semibold hover:text-flame-soft">{c.title}</Link>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="capitalize">{c.media_type}</span>
                  <span>· {formatDate(c.created_at)}</span>
                  <span>· {compactNumber(c.view_count)} views</span>
                  <span>· {compactNumber(c.like_count)} likes</span>
                  {!c.is_published && <span className="rounded-full bg-ink-3 px-2 text-fg">Unpublished</span>}
                  {c.moderation_state !== 'active' && (
                    <span className={`rounded-full px-2 ${STATE_BADGE[c.moderation_state]}`}>{c.moderation_state.replace('_', ' ')}</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">{c.tags.map((t) => `#${t.name}`).join(' ') || 'No tags'}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link to={`/admin/content/${c.id}/edit`} className="btn-ghost px-3 py-1.5 text-xs">Edit</Link>
                <button onClick={() => toggleHidden(c)} disabled={busy === c.id} className="btn-ghost px-3 py-1.5 text-xs">
                  {c.moderation_state === 'hidden' || c.moderation_state === 'removed' ? 'Unhide' : 'Hide'}
                </button>
                <button onClick={() => remove(c)} disabled={busy === c.id} className="btn-danger px-3 py-1.5 text-xs">
                  {busy === c.id ? 'Working…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.initialized && list.items.length > 0 && (
        <ListFooter loading={list.loading} error={list.error} hasMore={list.hasMore} count={list.items.length} onMore={list.loadMore} endText="That's every post." />
      )}
    </div>
  );
}
