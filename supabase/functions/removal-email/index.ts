// Supabase Edge Function: removal-email
//
// Sends removal-request emails SERVER-SIDE so no email API key ever reaches
// the browser.
//
//   action "acknowledge"  (public)  → one confirmation email per request, only
//                                     within 1 hour of submission, only once.
//   action "respond"      (admins)  → admin reply to the requester. The caller's
//                                     JWT is checked with is_admin().
//
// Secrets (set with `supabase secrets set ...`, never in the frontend):
//   RESEND_API_KEY      API key of the email provider (Resend by default)
//   EMAIL_FROM          e.g. "OnlyFap Moderation <moderation@yourdomain.example>"
//   ADMIN_NOTIFY_EMAIL  optional: moderators are told about urgent requests
//   SITE_URL            optional: public site origin used in email links
// Provided automatically by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.
//
// If the provider is not configured the function answers
// { sent: false, reason: "not_configured" } — it never pretends to send.
//
// Deploy:  supabase functions deploy removal-email
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() ? v.trim() : undefined;
}

/** Provider adapter. Swap this function to use Postmark, SES, SendGrid, etc. */
async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM');
  if (!key || !from) return { ok: false, error: 'not_configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: subject.slice(0, 200), text }),
  });
  if (!res.ok) return { ok: false, error: `provider_${res.status}` };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ sent: false, reason: 'error', message: 'POST only' }, 405);

  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = env('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return json({ sent: false, reason: 'error', message: 'Function misconfigured' }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ sent: false, reason: 'error', message: 'Invalid JSON' }, 400);
  }
  const requestId = String(body?.request_id ?? '');
  if (!UUID.test(requestId)) return json({ sent: false, reason: 'error', message: 'Invalid request id' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: rr, error } = await admin
    .from('removal_requests')
    .select('id, reference, email, reason, priority, status, created_at, ack_sent_at, content_id, content_snapshot')
    .eq('id', requestId)
    .maybeSingle();
  if (error || !rr) return json({ sent: false, reason: 'error', message: 'Request not found' }, 404);

  const site = env('SITE_URL') ?? '';
  const configured = Boolean(env('RESEND_API_KEY') && env('EMAIL_FROM'));

  if (body.action === 'acknowledge') {
    // Abuse guard: only once, only shortly after submission.
    if (rr.ack_sent_at) return json({ sent: false, reason: 'already_sent' });
    if (Date.now() - new Date(rr.created_at).getTime() > 60 * 60 * 1000) return json({ sent: false, reason: 'error', message: 'Too late to acknowledge' }, 400);
    if (!configured) return json({ sent: false, reason: 'not_configured' });

    // Claim the acknowledgement atomically so parallel calls send only one email.
    const { data: claimed } = await admin
      .from('removal_requests')
      .update({ ack_sent_at: new Date().toISOString() })
      .eq('id', rr.id)
      .is('ack_sent_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) return json({ sent: false, reason: 'already_sent' });

    const text = [
      'Hello,',
      '',
      `We received your content removal request. Your reference is ${rr.reference}.`,
      '',
      'A moderator will review it. Requests about consent, a person depicted, or possible minors are prioritised.',
      'We will reply to this address once the review is complete. Please quote your reference in any follow-up.',
      '',
      site ? `Content Removal Policy: ${site}/legal/content-removal` : '',
      '',
      'This is an automated message.',
    ].join('\n');
    const sent = await sendEmail(rr.email, `We received your request ${rr.reference}`, text);
    if (!sent.ok) {
      await admin.from('removal_requests').update({ ack_sent_at: null }).eq('id', rr.id);
      return json({ sent: false, reason: 'error', message: sent.error });
    }
    await admin.from('moderation_actions').insert({ removal_request_id: rr.id, content_id: rr.content_id, action: 'email_sent', note: 'Acknowledgement to requester' });

    const notify = env('ADMIN_NOTIFY_EMAIL');
    if (notify && rr.priority === 'urgent') {
      await sendEmail(notify, `URGENT removal request ${rr.reference}`, `An urgent removal request (${rr.reason}) was submitted.\n${site ? `${site}/admin/removal-requests/${rr.id}` : ''}`);
    }
    return json({ sent: true });
  }

  if (body.action === 'respond') {
    // Verify the caller is an admin using THEIR token (not the service key).
    const auth = req.headers.get('Authorization') ?? '';
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: isAdmin } = await asUser.rpc('is_admin');
    if (isAdmin !== true) return json({ sent: false, reason: 'error', message: 'Not authorized' }, 403);

    const subject = String(body.subject ?? '').trim().slice(0, 200) || `Your removal request ${rr.reference}`;
    const message = String(body.message ?? '').trim().slice(0, 5000);
    if (message.length < 5) return json({ sent: false, reason: 'error', message: 'Message is empty' }, 400);
    if (!configured) return json({ sent: false, reason: 'not_configured' });

    const sent = await sendEmail(rr.email, subject, `${message}\n\nReference: ${rr.reference}`);
    if (!sent.ok) return json({ sent: false, reason: 'error', message: sent.error });

    const { data: userData } = await asUser.auth.getUser();
    await admin.from('removal_requests').update({ last_response_at: new Date().toISOString() }).eq('id', rr.id);
    await admin.from('moderation_actions').insert({
      removal_request_id: rr.id,
      content_id: rr.content_id,
      actor_id: userData.user?.id ?? null,
      action: 'email_sent',
      note: `Reply sent: ${subject}`,
    });
    return json({ sent: true });
  }

  return json({ sent: false, reason: 'error', message: 'Unknown action' }, 400);
});
