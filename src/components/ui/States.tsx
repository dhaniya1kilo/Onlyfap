import type { ReactNode } from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-8 text-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner label="Loading OnlyFap" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="panel mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-flame-soft" aria-hidden="true" />
      <p className="text-sm text-fg">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
      <Inbox className="h-8 w-8 text-muted" aria-hidden="true" />
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video rounded-xl bg-ink-3" />
      <div className="mt-3 h-4 w-3/4 rounded bg-ink-3" />
      <div className="mt-2 h-3 w-1/2 rounded bg-ink-3" />
    </div>
  );
}
