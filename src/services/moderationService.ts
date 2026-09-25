import { supabase } from '../lib/supabase';
import { getAnonId } from '../lib/anonId';
import type {
  ContentCompliance,
  ContentReport,
  ModerationAction,
  ModerationState,
  Page,
  RemovalReason,
  RemovalRequest,
  RemovalResolution,
  RemovalStatus,
  ReportReason,
  ReportStatus,
} from '../types';

// ---------------------------------------------------------------------------
// Public submissions (go through SECURITY DEFINER RPCs that validate,
// de-duplicate and rate-limit; the tables themselves are admin-only).
// ---------------------------------------------------------------------------

export interface RemovalRequestInput {
  contentId: string | null;
  contentUrl: string;
  email: string;
  name: string;
  reason: RemovalReason;
  details: string;
  additionalInfo: string;
  goodFaith: boolean;
}

export interface SubmitResult {
  id: string;
  reference: string;
  duplicate: boolean;
}

export async function submitRemovalRequest(input: RemovalRequestInput): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_removal_request', {
    p_content_id: input.contentId,
    p_content_url: input.contentUrl || null,
    p_email: input.email.trim(),
    p_name: input.name.trim() || null,
    p_reason: input.reason,
    p_details: input.details.trim(),
    p_additional_info: input.additionalInfo.trim() || null,
    p_good_faith: input.goodFaith,
    p_requester: getAnonId(),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as SubmitResult | null;
  if (!row) throw new Error('No confirmation was returned.');
  return row;
}

export async function submitReport(contentId: string, reason: ReportReason, details: string): Promise<{ id: string; duplicate: boolean }> {
  const { data, error } = await supabase.rpc('submit_content_report', {
    p_content_id: contentId,
    p_reason: reason,
    p_details: details.trim() || null,
    p_reporter: getAnonId(),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; duplicate: boolean } | null;
  if (!row) throw new Error('No confirmation was returned.');
  return row;
}

// ---------------------------------------------------------------------------
// Admin (RLS: only is_admin() can read or change these tables)
// ---------------------------------------------------------------------------

export async function listRemovalRequests(
  status: RemovalStatus | 'open' | 'all',
  offset: number,
  limit: number,
): Promise<Page<RemovalRequest>> {
  let q = supabase.from('removal_requests').select('*');
  if (status === 'open') q = q.in('status', ['pending', 'reviewing']);
  else if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = (data ?? []) as RemovalRequest[];
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getRemovalRequest(id: string): Promise<RemovalRequest | null> {
  const { data, error } = await supabase.from('removal_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as RemovalRequest) ?? null;
}

export async function updateRemovalRequest(
  id: string,
  patch: { status?: RemovalStatus; admin_notes?: string | null; resolution?: RemovalResolution | null },
): Promise<void> {
  const { error } = await supabase.from('removal_requests').update(patch).eq('id', id);
  if (error) throw error;
}

export async function listReports(status: ReportStatus | 'all', offset: number, limit: number): Promise<Page<ContentReport & { content_title?: string | null }>> {
  let q = supabase.from('content_reports').select('*, content:content_id(title)');
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q.order('created_at', { ascending: false }).range(offset, offset + limit);
  if (error) throw error;
  const rows = ((data ?? []) as (ContentReport & { content?: { title: string } | null })[]).map((r) => ({
    ...r,
    content_title: r.content?.title ?? null,
  }));
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function updateReport(id: string, patch: { status?: ReportStatus; admin_notes?: string | null }): Promise<void> {
  const body: Record<string, unknown> = { ...patch };
  if (patch.status && patch.status !== 'open') body.reviewed_at = new Date().toISOString();
  const { data: s } = await supabase.auth.getUser();
  if (s.user) body.reviewed_by = s.user.id;
  const { error } = await supabase.from('content_reports').update(body).eq('id', id);
  if (error) throw error;
}

export async function setContentState(contentId: string, state: ModerationState, note?: string, requestId?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_content_state', {
    p_content_id: contentId,
    p_state: state,
    p_note: note?.trim() || null,
    p_request_id: requestId ?? null,
  });
  if (error) throw error;
}

export async function listModerationActions(filter: { requestId?: string; contentId?: string }, limit = 50): Promise<ModerationAction[]> {
  let q = supabase.from('moderation_actions').select('*');
  if (filter.requestId && filter.contentId) {
    q = q.or(`removal_request_id.eq.${filter.requestId},content_id.eq.${filter.contentId}`);
  } else if (filter.requestId) q = q.eq('removal_request_id', filter.requestId);
  else if (filter.contentId) q = q.eq('content_id', filter.contentId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as ModerationAction[];
}

export async function getCompliance(contentId: string): Promise<ContentCompliance | null> {
  const { data, error } = await supabase.from('content_compliance').select('*').eq('content_id', contentId).maybeSingle();
  if (error) throw error;
  return (data as ContentCompliance) ?? null;
}

export async function saveCompliance(record: Omit<ContentCompliance, 'verified_by' | 'verified_at' | 'updated_at'>, markVerified: boolean): Promise<void> {
  const body: Record<string, unknown> = { ...record };
  if (markVerified) {
    const { data } = await supabase.auth.getUser();
    body.verified_by = data.user?.id ?? null;
    body.verified_at = new Date().toISOString();
  }
  const { error } = await supabase.from('content_compliance').upsert(body, { onConflict: 'content_id' });
  if (error) throw error;
}
