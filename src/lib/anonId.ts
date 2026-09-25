/**
 * A random, per-browser token used ONLY for de-duplicating views and
 * rate-limiting reports/requests. It is not derived from any personal data
 * (no IP, no fingerprinting) and the database stores only a SHA-256 hash.
 * Clearing site data resets it.
 */
const KEY = 'onlyfap:anon-id';
let memory: string | null = null;

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
}

export function getAnonId(): string {
  if (memory) return memory;
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return (memory = existing);
    const fresh = randomToken();
    localStorage.setItem(KEY, fresh);
    return (memory = fresh);
  } catch {
    return (memory = randomToken());
  }
}
