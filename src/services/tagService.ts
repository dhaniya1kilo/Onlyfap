import { supabase } from '../lib/supabase';
import type { Tag, TagWithUsage } from '../types';
import { slugify } from '../utils/format';

export async function fetchCategories(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('is_category', true)
    .order('sort_order')
    .order('name')
    .limit(30);
  if (error) throw error;
  return data as Tag[];
}

export async function fetchTagBySlug(slug: string): Promise<Tag | null> {
  const { data, error } = await supabase.from('tags').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return (data as Tag) ?? null;
}

export async function searchTags(term: string, limit = 8): Promise<Tag[]> {
  let q = supabase.from('tags').select('*').order('name').limit(limit);
  const t = term.trim();
  if (t) q = q.ilike('name', `%${t.replace(/[%_\\]/g, (c) => '\\' + c)}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data as Tag[];
}

export async function listTagsWithUsage(): Promise<TagWithUsage[]> {
  const { data, error } = await supabase.from('tag_usage').select('*').order('name').limit(1000);
  if (error) throw error;
  return (data as TagWithUsage[]).map((t) => ({ ...t, usage_count: Number(t.usage_count) }));
}

/** Returns the existing tag (case-insensitive) or creates it. */
export async function getOrCreateTag(name: string): Promise<Tag> {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
  const slug = slugify(clean);
  if (!clean || !slug) throw new Error('Tag names need at least one letter or number.');
  const existing = await supabase.from('tags').select('*').eq('slug', slug).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as Tag;
  const { data, error } = await supabase.from('tags').insert({ name: clean, slug }).select('*').single();
  if (error?.code === '23505') {
    const again = await supabase.from('tags').select('*').ilike('name', clean).maybeSingle();
    if (again.data) return again.data as Tag;
  }
  if (error) throw error;
  return data as Tag;
}

export async function updateTag(id: string, patch: { name?: string; is_category?: boolean; sort_order?: number }) {
  const body: Record<string, unknown> = { ...patch };
  if (patch.name !== undefined) {
    const clean = patch.name.trim().replace(/\s+/g, ' ');
    const slug = slugify(clean);
    if (!clean || !slug) throw new Error('Tag names need at least one letter or number.');
    body.name = clean;
    body.slug = slug; // relationships use tag ids, so renaming is safe
  }
  const { error } = await supabase.from('tags').update(body).eq('id', id);
  if (error) throw error;
}

/** DB enforces ON DELETE RESTRICT, so a tag still in use cannot be deleted. */
export async function deleteTag(id: string) {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}
