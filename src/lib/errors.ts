/** Convert any thrown value into a short, non-sensitive message for users. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!err) return fallback;
  const e = err as { message?: string; code?: string; status?: number };
  const msg = (e.message || '').toLowerCase();
  // Messages raised deliberately by our own SQL functions are written for users.
  if (e.code === 'OF429' || e.code === '22023' || e.code === '28000') return e.message || fallback;
  if (e.code === '23505') return 'That already exists.';
  if (e.code === '23503') return 'This item is still in use and cannot be removed.';
  if (e.code === '42501' || msg.includes('row-level security') || msg.includes('not authorized') || msg.includes('permission denied'))
    return 'You do not have permission to do that.';
  if (msg.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (msg.includes('email not confirmed')) return 'Confirm your email address, then log in.';
  if (msg.includes('user already registered')) return 'An account with this email already exists.';
  if (msg.includes('anonymous sign-ins are disabled')) return 'Log in or create an account to like posts.';
  if (msg.includes('password should be')) return e.message ?? fallback;
  if (msg.includes('jwt') && msg.includes('expired')) return 'Your session expired. Log in again.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Network problem. Check your connection and retry.';
  if (msg.includes('payload too large') || e.status === 413) return 'That file is too large.';
  if (msg.includes('too many') || e.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  return fallback;
}
