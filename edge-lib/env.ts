/**
 * Shared helpers for Cloudflare Pages Functions (run at the edge, not in the
 * browser bundle). They read ONLY public data with the anon key; Postgres
 * RLS decides what is visible. Never put the service_role key here.
 */
export interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SITE_URL?: string;
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil: (p: Promise<unknown>) => void;
}

export function siteOrigin(env: Env, request: Request): string {
  try {
    if (env.VITE_SITE_URL) return new URL(env.VITE_SITE_URL).origin;
  } catch {
    /* fall through */
  }
  return new URL(request.url).origin;
}

export async function supabaseGet<T>(env: Env, pathAndQuery: string): Promise<T | null> {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${env.VITE_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string);
}
