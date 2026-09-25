import { Link, useSearchParams } from 'react-router-dom';
import { RemovalRequestForm } from '../components/engagement/RemovalRequestForm';
import { useSeo } from '../hooks/useSeo';
import { absoluteUrl } from '../lib/site';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /report — general removal request / report form (content link typed in, or ?content=<id>). */
export default function ReportPage() {
  const [params] = useSearchParams();
  const raw = params.get('content') ?? '';
  const contentId = UUID.test(raw) ? raw : null;
  useSeo({ title: 'Report content / request removal', description: 'Ask us to review or remove content on OnlyFap.', canonical: '/report' });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-flame-soft">Safety</p>
        <h1 className="text-3xl font-extrabold">Report content / request removal</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Use this form if you appear in content without consent, own the copyright, have a privacy concern, or believe something breaks our rules.
          The quickest way is the <strong className="text-fg">Report / request removal</strong> button on the post itself, which fills in the link for
          you. Read how we handle requests in the <Link to="/legal/content-removal" className="text-flame-soft underline">Content Removal Policy</Link>.
        </p>
      </div>
      <div className="panel p-5 sm:p-6">
        <RemovalRequestForm contentId={contentId} contentUrl={contentId ? absoluteUrl(`/content/${contentId}`) : ''} />
      </div>
    </div>
  );
}
