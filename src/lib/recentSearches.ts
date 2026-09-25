/** Recent searches are kept ONLY on this device (localStorage), never sent anywhere. */
const KEY = 'onlyfap:recent-searches';
const MAX = 6;

export function getRecentSearches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(q: string) {
  const clean = q.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (clean.length < 2) return;
  try {
    const next = [clean, ...getRecentSearches().filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
