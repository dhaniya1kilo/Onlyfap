/**
 * Central brand + legal configuration. Values come from public VITE_* env
 * vars (safe to expose) and fall back to clearly visible placeholders so a
 * missing value is obvious rather than silently invented.
 */
function clean(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

function originFromEnv(): string {
  const raw = clean(import.meta.env.VITE_SITE_URL);
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through */
    }
  }
  return typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
}

export const SITE = {
  name: 'OnlyFap',
  tagline: 'Trending adult videos and photos, for verified adults only.',
  description:
    'OnlyFap is an adults-only (18+) platform to discover trending videos and photos, search by tag, and browse in a full-screen vertical feed.',
  origin: originFromEnv(),
  themeColor: '#0C0B10',
};

/** Legal placeholders. Unset values render as a visible [PLACEHOLDER]. */
export const LEGAL = {
  entity: clean(import.meta.env.VITE_LEGAL_ENTITY_NAME),
  address: clean(import.meta.env.VITE_BUSINESS_ADDRESS),
  email: clean(import.meta.env.VITE_CONTACT_EMAIL),
  country: clean(import.meta.env.VITE_JURISDICTION_COUNTRY),
  dmcaAgent: clean(import.meta.env.VITE_DMCA_AGENT),
};

export const LEGAL_PLACEHOLDERS = {
  entity: '[LEGAL ENTITY NAME]',
  address: '[BUSINESS ADDRESS]',
  email: '[CONTACT EMAIL]',
  country: '[COUNTRY]',
  dmcaAgent: '[DMCA AGENT DETAILS IF APPLICABLE]',
} as const;

export const FEATURES = {
  anonymousLikes: import.meta.env.VITE_ENABLE_ANONYMOUS_LIKES === 'true',
  emailFunction: import.meta.env.VITE_EMAIL_FUNCTION_ENABLED === 'true',
};

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.origin).toString();
}
