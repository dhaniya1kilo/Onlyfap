import { supabase } from '../lib/supabase';
import { FEATURES } from '../lib/site';

/**
 * Email is sent ONLY by the `removal-email` Supabase Edge Function
 * (supabase/functions/removal-email). The email provider API key lives in
 * that function's secrets — never in this frontend.
 *
 * Every call reports honestly whether an email was actually sent.
 */
export interface EmailResult {
  sent: boolean;
  reason?: 'not_configured' | 'disabled' | 'already_sent' | 'error';
  message?: string;
}

async function invoke(body: Record<string, unknown>): Promise<EmailResult> {
  if (!FEATURES.emailFunction) return { sent: false, reason: 'disabled' };
  try {
    const { data, error } = await supabase.functions.invoke('removal-email', { body });
    if (error) return { sent: false, reason: 'error', message: error.message };
    const r = data as EmailResult | null;
    return r && typeof r.sent === 'boolean' ? r : { sent: false, reason: 'error' };
  } catch (e) {
    return { sent: false, reason: 'error', message: (e as Error).message };
  }
}

/** Ask the backend to email the requester an acknowledgement with their reference. */
export function sendRemovalAcknowledgement(requestId: string): Promise<EmailResult> {
  return invoke({ action: 'acknowledge', request_id: requestId });
}

/** Admin only (the function re-checks admin rights server-side). */
export function sendAdminResponse(requestId: string, subject: string, message: string): Promise<EmailResult> {
  return invoke({ action: 'respond', request_id: requestId, subject, message });
}
