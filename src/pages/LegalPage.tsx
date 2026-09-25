import { Link, useParams } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import { LEGAL_DRAFT, LEGAL_LAST_UPDATED, LEGAL_PAGES, findLegalPage } from '../content/legal';
import { useSeo } from '../hooks/useSeo';
import NotFoundPage from './NotFoundPage';

export default function LegalPage() {
  const { slug } = useParams();
  const page = findLegalPage(slug);
  useSeo({ title: page?.title, description: page?.summary, canonical: page ? `/legal/${page.slug}` : undefined, noindex: !page || LEGAL_DRAFT });
  if (!page) return <NotFoundPage />;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
      <article className="prose-legal min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-flame-soft">Legal</p>
        <h1 className="text-3xl font-extrabold">{page.title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
        {LEGAL_DRAFT && (
          <div role="note" className="my-6 flex gap-3 rounded-xl border border-velvet/50 bg-velvet/10 p-4 text-sm">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-[#C4B5FD]" aria-hidden="true" />
            <p className="!mt-0">
              <strong>Draft template.</strong> This page is a draft that must be reviewed by a qualified lawyer before it is relied on. Items shown like{' '}
              <span className="placeholder-token">[THIS]</span> still need real details. It does not claim that the operator holds any licence,
              registration or certification.
            </p>
          </div>
        )}
        <div className="mt-6">{page.body()}</div>
      </article>
      <nav aria-label="Legal pages" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-sm font-semibold">Policies</p>
        <ul className="space-y-1 text-sm">
          {LEGAL_PAGES.map((p) => (
            <li key={p.slug}>
              <Link
                to={`/legal/${p.slug}`}
                aria-current={p.slug === page.slug ? 'page' : undefined}
                className={`block rounded-lg px-3 py-1.5 ${p.slug === page.slug ? 'bg-ink-3 text-fg' : 'text-muted hover:text-fg'}`}
              >
                {p.navLabel}
              </Link>
            </li>
          ))}
          <li><Link to="/report" className="block rounded-lg px-3 py-1.5 text-muted hover:text-fg">Report content</Link></li>
        </ul>
      </nav>
    </div>
  );
}
