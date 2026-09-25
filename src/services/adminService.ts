import { supabase } from '../lib/supabase';
import type { AdminUserRow, ContentItem, ContentReport, DashboardStats, Page } from '../types';
import { browseContent, normalize } from './contentService';

export async function fetchDashboard(): Promise<{
  stats: DashboardStats;
  recent: ContentItem[];
  trending: ContentItem[];
  reports: (ContentReport & { content_title?: string | null })[];
}> {
  const [stats, recent, trending, reports] = await Promise.all([
    supabase.rpc('admin_dashboard_stats'),
    supabase.from('content_feed').select('*').order('created_at', { ascending: false }).limit(6),
    browseContent({ sort: 'trending' }, 0, 5),
    supabase.from('content_reports').select('*, content:content_id(title)').order('created_at', { ascending: false }).limit(5),
  ]);
  const err = stats.error || recent.error || reports.error;
  if (err) throw err;
  const raw = (stats.data ?? {}) as Record<string, unknown>;
  const num = (k: string) => Number(raw[k] ?? 0);
  return {
    stats: {
      total_content: num('total_content'),
      public_content: num('public_content'),
      hidden_content: num('hidden_content'),
      under_review: num('under_review'),
      total_views: num('total_views'),
      total_likes: num('total_likes'),
      views_7d: num('views_7d'),
      likes_7d: num('likes_7d'),
      active_ads: num('active_ads'),
      total_tags: num('total_tags'),
      pending_removals: num('pending_removals'),
      urgent_removals: num('urgent_removals'),
      open_reports: num('open_reports'),
      total_users: num('total_users'),
      missing_compliance: num('missing_compliance'),
    },
    recent: normalize(recent.data),
    trending: trending.items,
    reports: ((reports.data ?? []) as (ContentReport & { content?: { title: string } | null })[]).map((r) => ({
      ...r,
      content_title: r.content?.title ?? null,
    })),
  };
}

export async function listUsers(offset: number, limit: number): Promise<Page<AdminUserRow>> {
  const { data, error } = await supabase.rpc('admin_list_users', { p_limit: limit + 1, p_offset: offset });
  if (error) throw error;
  const rows = ((data ?? []) as AdminUserRow[]).map((r) => ({ ...r, like_count: Number(r.like_count) }));
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

// ---------- settings ----------
export interface SiteSettings {
  auto_hide_urgent_requests: boolean;
  auto_hide_report_threshold: number;
}

export async function getSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from('site_settings').select('key, value');
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [(r as { key: string }).key, (r as { value: unknown }).value]));
  return {
    auto_hide_urgent_requests: map.get('auto_hide_urgent_requests') === true,
    auto_hide_report_threshold: Number(map.get('auto_hide_report_threshold') ?? 0) || 0,
  };
}

export async function saveSettings(s: SiteSettings): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const rows = [
    { key: 'auto_hide_urgent_requests', value: s.auto_hide_urgent_requests, updated_by: data.user?.id ?? null },
    { key: 'auto_hide_report_threshold', value: Math.max(0, Math.min(50, Math.round(s.auto_hide_report_threshold))), updated_by: data.user?.id ?? null },
  ];
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}

// ---------- search analytics ----------
export interface SearchQueryRow {
  id: string;
  query: string;
  search_count: number;
  result_count: number | null;
  is_blocked: boolean;
  last_searched_at: string;
}

export async function listSearchQueries(limit = 50): Promise<SearchQueryRow[]> {
  const { data, error } = await supabase
    .from('search_queries')
    .select('id, query, search_count, result_count, is_blocked, last_searched_at')
    .order('search_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as SearchQueryRow[]).map((r) => ({ ...r, search_count: Number(r.search_count) }));
}

export async function setSearchQueryBlocked(id: string, blocked: boolean): Promise<void> {
  const { error } = await supabase.from('search_queries').update({ is_blocked: blocked }).eq('id', id);
  if (error) throw error;
}
