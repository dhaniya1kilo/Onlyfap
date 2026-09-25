import { createClient } from '@supabase/supabase-js';

// Public Supabase project configuration.
// These values are safe to expose in a browser; Supabase RLS must protect data.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://fdccqmjvtwshmqpqhrrj.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SqyDBn2LWJ3HjvG3fWuX-g_fDAUDKCT';

/** True when env vars are present. The app shows a setup screen otherwise. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Only the public anon key is ever used in the browser. RLS enforces access.
export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export const SUPABASE_URL = url || '';
export const SUPABASE_ANON_KEY = anonKey || '';
export const MEDIA_BUCKET = 'content-media';
