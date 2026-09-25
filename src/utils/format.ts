// All formatting uses the visitor's own locale (Intl) so dates and numbers
// read naturally for an international audience. Timestamps are stored in UTC.

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s) || s < 0) return formatDate(iso);
  if (s < 60) return rtf ? rtf.format(0, 'second') : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return rtf ? rtf.format(-m, 'minute') : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return rtf ? rtf.format(-h, 'hour') : `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return rtf ? rtf.format(-days, 'day') : `${days} days ago`;
  return formatDate(iso);
}

/** 1234 → "1.2K", 1400000 → "1.4M" (locale-aware). */
export function compactNumber(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

/** "1.2K views" / "1 view" */
export function viewsLabel(n: number): string {
  return `${compactNumber(n)} ${n === 1 ? 'view' : 'views'}`;
}

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
