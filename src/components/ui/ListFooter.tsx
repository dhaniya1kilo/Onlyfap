import { Spinner, ErrorState } from './States';
import { Sentinel } from './Sentinel';

interface Props {
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  count: number;
  onMore: () => void;
  endText?: string;
}

/** Shared tail for infinite lists: auto-load, retry, end marker. */
export function ListFooter({ loading, error, hasMore, count, onMore, endText = "You've reached the end." }: Props) {
  if (error) return <div className="py-6"><ErrorState message={error} onRetry={onMore} /></div>;
  if (loading) return <Spinner label="Loading more" />;
  if (hasMore) {
    return (
      <div className="flex flex-col items-center py-6">
        <Sentinel onVisible={onMore} disabled={loading} />
        <button className="btn-ghost" onClick={onMore}>Load more</button>
      </div>
    );
  }
  if (count > 0) return <p className="py-8 text-center text-sm text-muted">{endText}</p>;
  return null;
}
