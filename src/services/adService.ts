import { supabase } from '../lib/supabase';
import type { Ad, AdType } from '../types';

export async function fetchActiveAds(): Promise<Ad[]> {
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  return data as Ad[];
}

export async function listAllAds(): Promise<Ad[]> {
  const { data, error } = await supabase.from('ads').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data as Ad[];
}

export interface AdInput {
  ad_type: AdType;
  label: string | null;
  ad_content: string;
  is_active: boolean;
}

export async function createAd(adminId: string, input: AdInput) {
  const { error } = await supabase.from('ads').insert({ ...input, admin_id: adminId });
  if (error) throw error;
}

export async function updateAd(id: string, input: Partial<AdInput>) {
  const { error } = await supabase.from('ads').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteAd(id: string) {
  const { error } = await supabase.from('ads').delete().eq('id', id);
  if (error) throw error;
}
