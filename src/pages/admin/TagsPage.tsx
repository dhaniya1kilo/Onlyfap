import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { TagWithUsage } from '../../types';
import { deleteTag, getOrCreateTag, listTagsWithUsage, updateTag } from '../../services/tagService';
import { friendlyError } from '../../lib/errors';
import { ErrorState, Spinner } from '../../components/ui/States';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export default function TagsPage() {
  useDocumentTitle('Manage tags', true);
  const [tags, setTags] = useState<TagWithUsage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    setLoadError(null);
    listTagsWithUsage().then(setTags).catch((e) => setLoadError(friendlyError(e, 'Could not load tags.')));
  }, []);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice({ ok: true, text: ok });
      load();
    } catch (e) {
      setNotice({ ok: false, text: friendlyError(e, 'That change could not be saved.') });
    } finally {
      setBusy(null);
    }
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    void run('new', async () => { await getOrCreateTag(newName); setNewName(''); }, 'Tag created.');
  };

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!tags) return <Spinner label="Loading tags" />;

  const shown = tags.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Manage tags</h1>
      <p className="max-w-prose text-sm text-muted">Tags marked as categories appear in the category bar on the feed and search pages. Tags that are still used by posts can't be deleted.</p>

      <form onSubmit={create} className="flex max-w-lg gap-2">
        <label htmlFor="new-tag" className="sr-only">New tag name</label>
        <input id="new-tag" className="input" placeholder="New tag name" maxLength={40} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={busy === 'new' || !newName.trim()}>Create tag</button>
      </form>

      {notice && <p role="status" className={`text-sm ${notice.ok ? 'text-mint' : 'text-[#ff8fb6]'}`}>{notice.text}</p>}

      <input className="input max-w-xs" placeholder="Filter tags" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tags" />

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-ink-line text-muted">
            <tr><th className="p-3 font-medium">Tag</th><th className="p-3 font-medium">Posts</th><th className="p-3 font-medium">Category</th><th className="p-3 font-medium sr-only">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-line">
            {shown.map((t) => (
              <tr key={t.id}>
                <td className="p-3">
                  {editing?.id === t.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => { e.preventDefault(); void run(t.id, () => updateTag(t.id, { name: editing.name }), 'Tag renamed.').then(() => setEditing(null)); }}
                    >
                      <input className="input py-1.5" autoFocus maxLength={40} value={editing.name} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} aria-label="Tag name" />
                      <button className="btn-primary px-3 py-1 text-xs" disabled={busy === t.id}>Save</button>
                      <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : (
                    <Link to={`/search?tag=${t.slug}`} className="font-medium hover:text-flame-soft">#{t.name}</Link>
                  )}
                </td>
                <td className="p-3 text-muted">{t.usage_count}</td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#E11D48]"
                    checked={t.is_category}
                    disabled={!!busy}
                    aria-label={`Show ${t.name} as a category`}
                    onChange={(e) => void run(t.id, () => updateTag(t.id, { is_category: e.target.checked }), 'Category updated.')}
                  />
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setEditing({ id: t.id, name: t.name })}>Rename</button>
                    <button
                      className="btn-danger px-3 py-1 text-xs"
                      disabled={t.usage_count > 0 || !!busy}
                      title={t.usage_count > 0 ? 'Remove this tag from its posts first' : undefined}
                      onClick={() => window.confirm(`Delete #${t.name}?`) && void run(t.id, () => deleteTag(t.id), 'Tag deleted.')}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">No tags match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
