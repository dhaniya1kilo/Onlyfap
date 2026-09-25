import { useId, useState, type FormEvent, type MouseEvent } from 'react';
import { CheckCircle2, Flag } from 'lucide-react';
import type { ReportReason } from '../../types';
import { REPORT_REASONS } from '../../lib/labels';
import { submitReport } from '../../services/moderationService';
import { friendlyError } from '../../lib/errors';
import { absoluteUrl } from '../../lib/site';
import { Modal } from '../ui/Modal';
import { RemovalRequestForm } from './RemovalRequestForm';

interface Target {
  id: string;
  title: string;
}

type Tab = 'removal' | 'report';

export function ReportDialog({ open, onClose, item }: { open: boolean; onClose: () => void; item: Target }) {
  const [tab, setTab] = useState<Tab>('removal');
  const tabCls = (on: boolean) => `flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${on ? 'bg-fg text-ink' : 'text-muted hover:text-fg'}`;
  return (
    <Modal open={open} onClose={onClose} title="Report / request removal" wide>
      <div role="tablist" aria-label="Report type" className="mb-5 flex gap-1 rounded-full bg-ink-3 p-1">
        <button type="button" role="tab" aria-selected={tab === 'removal'} className={tabCls(tab === 'removal')} onClick={() => setTab('removal')}>
          Request removal
        </button>
        <button type="button" role="tab" aria-selected={tab === 'report'} className={tabCls(tab === 'report')} onClick={() => setTab('report')}>
          Quick report
        </button>
      </div>
      {tab === 'removal' ? (
        <RemovalRequestForm contentId={item.id} contentUrl={absoluteUrl(`/content/${item.id}`)} contentTitle={item.title} onClose={onClose} />
      ) : (
        <QuickReport contentId={item.id} onClose={onClose} />
      )}
    </Modal>
  );
}

function QuickReport({ contentId, onClose }: { contentId: string; onClose: () => void }) {
  const uid = useId();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!reason) return setError('Choose a reason.');
    setBusy(true);
    setError(null);
    try {
      const r = await submitReport(contentId, reason, details);
      setDone(r.duplicate);
    } catch (err) {
      setError(friendlyError(err, 'Your report could not be sent. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (done !== null) {
    return (
      <div className="space-y-4 text-sm" role="status">
        <p className="flex items-center gap-2 font-semibold text-mint">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {done ? 'You already reported this post' : 'Thanks, report received'}
        </p>
        <p className="text-muted">Our moderators review reports. If you need a reply, use “Request removal” instead so we have your email.</p>
        <button type="button" className="btn-primary" onClick={onClose}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-sm" noValidate>
      <p className="text-muted">Anonymous. No email needed — we cannot reply to quick reports.</p>
      <fieldset>
        <legend className="label">What is wrong?</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 ${reason === r.value ? 'border-flame-soft bg-flame/10' : 'border-ink-line hover:bg-ink-3'}`}>
              <input type="radio" name={`${uid}-r`} checked={reason === r.value} onChange={() => setReason(r.value)} className="h-4 w-4 accent-[#E11D48]" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${uid}-d`} className="label">Details <span className="font-normal text-muted">(optional)</span></label>
        <textarea id={`${uid}-d`} rows={3} maxLength={2000} className="input" value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
    </form>
  );
}

/** Small trigger + dialog, used on cards, slides and the viewer. */
export function ReportButton({ item, variant = 'inline' }: { item: Target; variant?: 'rail' | 'inline' | 'link' }) {
  const [open, setOpen] = useState(false);
  const openIt = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };
  return (
    <>
      {variant === 'rail' ? (
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={openIt} className="rail-btn" aria-label="Report or request removal">
            <Flag className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-xs font-semibold text-white text-shadow" aria-hidden="true">Report</span>
        </div>
      ) : variant === 'link' ? (
        <button type="button" onClick={openIt} className="inline-flex items-center gap-1.5 text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Report / request removal
        </button>
      ) : (
        <button type="button" onClick={openIt} className="btn-ghost">
          <Flag className="h-4 w-4" aria-hidden="true" /> Report / request removal
        </button>
      )}
      <ReportDialog open={open} onClose={() => setOpen(false)} item={item} />
    </>
  );
}
