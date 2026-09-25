import { useId, useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RemovalReason } from '../../types';
import { REMOVAL_REASONS } from '../../lib/labels';
import { submitRemovalRequest, type SubmitResult } from '../../services/moderationService';
import { sendRemovalAcknowledgement, type EmailResult } from '../../services/emailService';
import { friendlyError } from '../../lib/errors';
import { FEATURES, LEGAL, LEGAL_PLACEHOLDERS } from '../../lib/site';

interface Props {
  contentId: string | null;
  /** Pre-filled content URL (read-only when contentId is known). */
  contentUrl: string;
  contentTitle?: string;
  onClose?: () => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Takedown / removal request. Stored for admin review; content is never removed automatically. */
export function RemovalRequestForm({ contentId, contentUrl, contentTitle, onClose }: Props) {
  const uid = useId();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState<RemovalReason | ''>('');
  const [details, setDetails] = useState('');
  const [extra, setExtra] = useState('');
  const [url, setUrl] = useState(contentUrl);
  const [goodFaith, setGoodFaith] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<(SubmitResult & { email: EmailResult | null }) | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (honeypot) return setDone({ id: '', reference: '', duplicate: false, email: null }); // bots
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address so we can reply to you.');
    if (!reason) return setError('Choose the reason for your request.');
    if (details.trim().length < 10) return setError('Describe the problem in a little more detail (at least 10 characters).');
    if (!contentId && !url.trim()) return setError('Paste the link to the content.');
    if (!goodFaith) return setError('Please confirm the statement at the end of the form.');
    setBusy(true);
    try {
      const res = await submitRemovalRequest({
        contentId,
        contentUrl: url.trim(),
        email,
        name,
        reason,
        details,
        additionalInfo: extra,
        goodFaith,
      });
      const mail = !res.duplicate && FEATURES.emailFunction ? await sendRemovalAcknowledgement(res.id) : null;
      setDone({ ...res, email: mail });
    } catch (err) {
      setError(friendlyError(err, 'Your request could not be sent. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const contact = LEGAL.email ?? LEGAL_PLACEHOLDERS.email;
    return (
      <div className="space-y-4 text-sm" role="status">
        <div className="flex items-center gap-2 text-mint">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <p className="font-semibold">{done.duplicate ? 'We already have your request' : 'Request received'}</p>
        </div>
        {done.reference && (
          <p>
            Your reference: <strong className="font-mono text-base">{done.reference}</strong>. Keep it for any follow-up.
          </p>
        )}
        <p className="text-muted">
          A moderator will review it. Requests about consent, a person depicted, or possible minors are prioritised.
        </p>
        {done.email?.sent ? (
          <p className="text-muted">We emailed a confirmation to <strong className="text-fg">{email.trim()}</strong>.</p>
        ) : (
          <p className="text-muted">
            No confirmation email was sent{done.email ? ' (email is temporarily unavailable)' : ''}. We will reply to{' '}
            <strong className="text-fg">{email.trim()}</strong> once the request is reviewed. You can also write to{' '}
            <span className="text-fg">{contact}</span> quoting your reference.
          </p>
        )}
        {onClose && <button type="button" className="btn-primary" onClick={onClose}>Done</button>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 text-sm">
      {contentId ? (
        <p className="rounded-xl bg-ink-3 p-3 text-muted">
          About: <span className="font-medium text-fg">{contentTitle || 'this post'}</span>
          <span className="mt-0.5 block break-all font-mono text-xs">{contentUrl}</span>
        </p>
      ) : (
        <div>
          <label htmlFor={`${uid}-url`} className="label">Link to the content</label>
          <input id={`${uid}-url`} type="url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/content/…" maxLength={2000} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-email`} className="label">Your email <span className="text-flame-soft">*</span></label>
          <input id={`${uid}-email`} type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
        </div>
        <div>
          <label htmlFor={`${uid}-name`} className="label">Your name <span className="font-normal text-muted">(optional)</span></label>
          <input id={`${uid}-name`} autoComplete="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
      </div>

      <fieldset>
        <legend className="label">Reason <span className="text-flame-soft">*</span></legend>
        <div className="grid gap-1.5">
          {REMOVAL_REASONS.map((r) => (
            <label key={r.value} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 ${reason === r.value ? 'border-flame-soft bg-flame/10' : 'border-ink-line hover:bg-ink-3'}`}>
              <input type="radio" name={`${uid}-reason`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="mt-0.5 h-4 w-4 accent-[#E11D48]" />
              <span>
                {r.label}
                {r.hint && <span className="ml-1 text-xs text-muted">{r.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {reason === 'underage_concern' && (
        <p className="rounded-xl border border-flame/50 bg-flame/10 p-3 text-xs leading-relaxed">
          If you believe this shows child sexual abuse material, please also report it to the authorities, for example the{' '}
          <a className="underline" href="https://report.cybertip.org/" target="_blank" rel="noopener noreferrer">NCMEC CyberTipline</a> (US) or the{' '}
          <a className="underline" href="https://report.iwf.org.uk/" target="_blank" rel="noopener noreferrer">Internet Watch Foundation</a> (UK/international).
          Do not download or share the material.
        </p>
      )}

      <div>
        <label htmlFor={`${uid}-details`} className="label">Details <span className="text-flame-soft">*</span></label>
        <textarea id={`${uid}-details`} rows={4} className="input" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={5000}
          placeholder="Explain what is wrong and what you would like us to do." />
      </div>
      <div>
        <label htmlFor={`${uid}-extra`} className="label">Additional information <span className="font-normal text-muted">(optional)</span></label>
        <textarea id={`${uid}-extra`} rows={2} className="input" value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={5000}
          placeholder="For copyright: identify the original work. Do not include ID documents here." />
      </div>

      {/* honeypot: hidden from people and screen readers, bots tend to fill it */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
      </div>

      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
        <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#E11D48]" />
        <span>
          I confirm that the information in this request is accurate to the best of my knowledge and that I am making it
          in good faith. I understand my email will be used only to handle this request (see the{' '}
          <Link to="/legal/privacy" className="underline">Privacy Policy</Link>).
        </span>
      </label>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary px-5" disabled={busy}>{busy ? 'Sending…' : 'Submit request'}</button>
        {onClose && <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>}
      </div>
    </form>
  );
}
