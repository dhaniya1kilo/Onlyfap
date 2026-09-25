import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { useSeo } from '../hooks/useSeo';
import { fetchLikedPage } from '../services/contentService';
import { ContentResultCard } from '../components/feed/ContentResultCard';
import { ListFooter } from '../components/ui/ListFooter';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';

export default function LikedPage() {
  useSeo({ title: 'Liked', noindex: true });
  const { user, loading } = useAuth();
  const list = useInfiniteList(fetchLikedPage, `liked|${user?.id ?? ''}`, 24, Boolean(user));

  if (loading) return <Spinner label="Loading" />;
  if (!user) {
    return (
      <EmptyState title="Your liked posts">
        <span className="flex flex-col items-center gap-3">
          Tap the <Heart className="inline h-4 w-4 align-[-2px]" aria-label="heart" /> on any post to save it here.
          <Link to="/login?next=/liked" className="btn-primary">Log in</Link>
        </span>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">Liked</h1>
      {!list.initialized && <Spinner label="Loading your likes" />}
      {list.initialized && list.error && list.items.length === 0 && <ErrorState message={list.error} onRetry={list.loadMore} />}
      {list.initialized && !list.error && list.items.length === 0 && (
        <EmptyState title="No likes yet">Tap the heart on a post to save it here. <Link to="/" className="text-flame-soft underline">See what's trending</Link></EmptyState>
      )}
      {list.items.length > 0 && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.items.map((c) => <ContentResultCard key={c.id} item={c} />)}
        </div>
      )}
      {list.initialized && list.items.length > 0 && (
        <ListFooter loading={list.loading} error={list.error} hasMore={list.hasMore} count={list.items.length} onMore={list.loadMore} />
      )}
    </div>
  );
}
