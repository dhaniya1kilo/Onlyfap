import { supabase } from '../lib/supabase';
import { getAnonId } from '../lib/anonId';
import type { BrowseSort, ContentItem, MediaType, ModerationState, Page, SearchSort } from '../types';

/**
 * Content API. Every list is paginated and ordered in Postgres (RPCs defined
 * in supabase/migrations). The browser never downloads the whole table.
 */

const FEED_VIEW = 'content_feed';

export function normalize(rows: unknown[] | null): ContentItem[] {
  return (rows ?? []).map((r) => {
    const row = r as ContentItem;
    return {
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : [],
      view_count: Number(row.view_count ?? 0),
      like_count: Number(row.like_count ?? 0),
      moderation_state: row.moderation_state ?? 'active',
    };
  });
}

function toPage(rows: ContentItem[], limit: number): Page<ContentItem> {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export interface BrowseParams {
  sort: BrowseSort;
  tag?: string;
  mediaType?: MediaType | 'all';
}

/** Trending / Most viewed / New / Old — see browse_content() in migration 002. */
export async function browseContent(params: BrowseParams, offset: number, limit: number): Promise<Page<ContentItem>> {
  const { data, error } = await supabase.rpc('browse_content', {
    p_sort: params.sort,
    p_tag: params.tag?.trim() || null,
    p_media_type: params.mediaType && params.mediaType !== 'all' ? params.mediaType : null,
    p_limit: limit + 1, // one extra row tells us whether there is another page
    p_offset: offset,
  });
  if (error) throw error;
  return toPage(normalize(data as unknown[]), limit);
}

/** Back-compat: the original newest-first feed. */
export function fetchFeedPage(offset: number, limit: number): Promise<Page<ContentItem>> {
  return browseContent({ sort: 'new' }, offset, limit);
}

export interface SearchParams {
  query?: string;
  tag?: string;
  mediaType?: MediaType | 'all';
  sort?: SearchSort;
}

/** Database-side search (title, description, tag names) with sorting. */
export async function searchContent(params: SearchParams, offset: number, limit: number): Promise<Page<ContentItem>> {
  const { data, error } = await supabase.rpc('search_content', {
    p_query: params.query?.trim() || null,
    p_tag: params.tag?.trim() || null,
    p_limit: limit + 1,
    p_offset: offset,
    p_sort: params.sort ?? 'relevance',
    p_media_type: params.mediaType && params.mediaType !== 'all' ? params.mediaType : null,
  });
  if (error) throw error;
  return toPage(normalize(data as unknown[]), limit);
}

export async function searchCount(params: SearchParams): Promise<number | null> {
  const { data, error } = await supabase.rpc('search_content_count', {
    p_query: params.query?.trim() || null,
    p_tag: params.tag?.trim() || null,
    p_media_type: params.mediaType && params.mediaType !== 'all' ? params.mediaType : null,
  });
  if (error) return null;
  return Number(data);
}

export async function fetchContentById(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabase.from(FEED_VIEW).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalize([data])[0] : null;
}

export async function fetchRelated(id: string, limit = 8): Promise<ContentItem[]> {
  const { data, error } = await supabase.rpc('related_content', { p_content_id: id, p_limit: limit });
  if (error) throw error;
  return normalize(data as unknown[]);
}

export async function fetchLikedPage(offset: number, limit: number): Promise<Page<ContentItem>> {
  const { data, error } = await supabase.rpc('liked_content', { p_limit: limit + 1, p_offset: offset });
  if (error) throw error;
  return toPage(normalize(data as unknown[]), limit);
}

// ---------------------------------------------------------------------------
// Views. The server counts at most one view per viewer per item per day;
// this in-memory + sessionStorage guard just avoids pointless requests.
// ---------------------------------------------------------------------------
const viewedThisTab = new Set<string>();

export async function recordView(id: string): Promise<boolean> {
  if (viewedThisTab.has(id)) return false;
  viewedThisTab.add(id);
  const key = `onlyfap:viewed:${id}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    /* storage unavailable: the in-memory set still de-duplicates */
  }
  const { data, error } = await supabase.rpc('record_view', { p_content_id: id, p_viewer: getAnonId() });
  if (error) return false;
  return data === true;
}

// ---------- admin ----------

export interface AdminListParams {
  state?: ModerationState | 'all' | 'unpublished';
  query?: string;
}

export async function adminListContent(offset: number, limit: number, params: AdminListParams = {}): Promise<Page<ContentItem>> {
  let q = supabase.from(FEED_VIEW).select('*');
  if (params.state === 'unpublished') q = q.eq('is_published', false);
  else if (params.state && params.state !== 'all') q = q.eq('moderation_state', params.state);
  const term = params.query?.trim();
  if (term) q = q.ilike('title', `%${term.replace(/[%_\\]/g, (c) => '\\' + c)}%`);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw error;
  return toPage(normalize(data), limit);
}

export interface ContentInput {
  title: string;
  description: string;
  is_published: boolean;
}

export interface MediaInput {
  path: string;
  url: string;
  type: MediaType;
  /** null for linked media whose type couldn't be guessed from the URL. */
  mime: string | null;
  /** Optional poster frame (uploaded videos). */
  thumbUrl?: string | null;
  thumbPath?: string | null;
}

export async function createContent(adminId: string, input: ContentInput, media: MediaInput): Promise<string> {
  const { data, error } = await supabase
    .from('content')
    .insert({
      admin_id: adminId,
      title: input.title.trim(),
      description: input.description.trim(),
      is_published: input.is_published,
      media_path: media.path,
      media_url: media.url,
      media_type: media.type,
      mime_type: media.mime,
      thumbnail_url: media.thumbUrl ?? null,
      thumbnail_path: media.thumbPath ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateContent(id: string, input: ContentInput, media?: MediaInput): Promise<void> {
  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description.trim(),
    is_published: input.is_published,
  };
  if (media) {
    Object.assign(patch, {
      media_path: media.path,
      media_url: media.url,
      media_type: media.type,
      mime_type: media.mime,
      thumbnail_url: media.thumbUrl ?? null,
      thumbnail_path: media.thumbPath ?? null,
    });
  }
  const { error } = await supabase.from('content').update(patch).eq('id', id);
  if (error) throw error;
}

export async function setContentTags(contentId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_content_tags', { p_content_id: contentId, p_tag_ids: tagIds });
  if (error) throw error;
}

/** Current thumbnail path of a post (admin), so a replaced poster can be cleaned up. */
export async function fetchThumbnailPath(id: string): Promise<string | null> {
  const { data } = await supabase.from('content').select('thumbnail_path').eq('id', id).maybeSingle();
  return ((data as { thumbnail_path?: string | null } | null)?.thumbnail_path) ?? null;
}

/**
 * Deletes the row (tags, likes, views, reports cascade; removal requests keep
 * a snapshot; the deletion is logged). Returns storage paths to clean up.
 */
export async function deleteContent(id: string): Promise<string[]> {
  const { data, error } = await supabase.from('content').delete().eq('id', id).select('media_path, thumbnail_path').maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('not authorized'), { code: '42501' });
  const row = data as { media_path: string | null; thumbnail_path: string | null };
  return [row.media_path, row.thumbnail_path].filter((p): p is string => Boolean(p));
}
