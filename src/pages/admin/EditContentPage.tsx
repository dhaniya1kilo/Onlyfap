import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ContentItem } from '../../types';
import { fetchContentById } from '../../services/contentService';
import { ContentForm } from '../../components/admin/ContentForm';
import { ModerationPanel } from '../../components/admin/ModerationPanel';
import { CompliancePanel } from '../../components/admin/CompliancePanel';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { friendlyError } from '../../lib/errors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { compactNumber } from '../../utils/format';

export default function EditContentPage() {
  const { id = '' } = useParams();
  const [item, setItem] = useState<ContentItem | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  useDocumentTitle('Edit content', true);

  useEffect(() => {
    let live = true;
    setError(null);
    fetchContentById(id)
      .then((c) => live && setItem(c))
      .catch((e) => live && setError(friendlyError(e, 'Could not load this post.')));
    return () => { live = false; };
  }, [id, version]);

  if (error) return <ErrorState message={error} onRetry={() => setVersion((v) => v + 1)} />;
  if (item === undefined) return <Spinner label="Loading post" />;
  if (item === null) return <EmptyState title="Post not found"><Link to="/admin/content" className="text-flame-soft underline">Back to content</Link></EmptyState>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Edit content</h1>
          <p className="mt-1 text-sm text-muted">{compactNumber(item.view_count)} views · {compactNumber(item.like_count)} likes</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/content/${item.id}`} className="btn-ghost">View</Link>
          <Link to="/admin/content" className="btn-ghost">Back to content</Link>
        </div>
      </div>
      {saved && <p role="status" className="text-sm text-mint">Changes saved.</p>}
      {/* key forces a fresh form after save so it reflects the stored row */}
      <ContentForm key={`${item.id}-${item.updated_at}`} existing={item} onDone={() => { setSaved(true); setVersion((v) => v + 1); }} />
      <div className="grid gap-6 xl:grid-cols-2">
        <ModerationPanel contentId={item.id} state={item.moderation_state} onChanged={() => setVersion((v) => v + 1)} />
        <CompliancePanel contentId={item.id} />
      </div>
    </div>
  );
}
