import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { listUsers } from '../../services/adminService';
import { ListFooter } from '../../components/ui/ListFooter';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { formatDate, formatDateTime } from '../../utils/format';

/** Read-only user list. Roles can only be changed in the Supabase SQL editor (by design). */
export default function UsersPage() {
  useDocumentTitle('Users', true);
  const list = useInfiniteList(listUsers, 'admin-users', 50);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Users</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Registered accounts and anonymous guest sessions (created only when a guest likes a post, if enabled). Admin rights are granted in the
          Supabase SQL editor — the browser can never change roles.
        </p>
      </div>
      {!list.initialized && <Spinner label="Loading users" />}
      {list.initialized && list.error && list.items.length === 0 && <ErrorState message={list.error} onRetry={list.loadMore} />}
      {list.initialized && !list.error && list.items.length === 0 && <EmptyState title="No users yet" />}
      {list.items.length > 0 && (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-ink-line text-muted">
              <tr>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Likes</th>
                <th className="p-3 font-medium">Joined</th>
                <th className="p-3 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {list.items.map((u) => (
                <tr key={u.id}>
                  <td className="p-3">
                    <p className="font-medium">{u.is_anonymous ? 'Guest session' : u.display_name || '—'}</p>
                    <p className="break-all text-xs text-muted">{u.email ?? u.id.slice(0, 8)}</p>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === 'admin' ? 'bg-flame text-white' : 'bg-ink-3 text-muted'}`}>{u.role}</span>
                  </td>
                  <td className="p-3 text-muted">{u.like_count.toLocaleString()}</td>
                  <td className="p-3 text-muted">{formatDate(u.created_at)}</td>
                  <td className="p-3 text-muted">{formatDateTime(u.last_sign_in_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.initialized && list.items.length > 0 && (
        <ListFooter loading={list.loading} error={list.error} hasMore={list.hasMore} count={list.items.length} onMore={list.loadMore} endText="That's everyone." />
      )}
    </div>
  );
}
