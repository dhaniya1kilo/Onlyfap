import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';
import { SITE } from '../lib/site';

/** /about */
export default function InfoPage() {
  useSeo({ title: `About ${SITE.name}`, description: SITE.description, canonical: '/about' });
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-extrabold">About {SITE.name}</h1>
      <p className="leading-relaxed text-fg/90">
        {SITE.name} is an adults-only platform for discovering trending videos and photos. Browse what is trending right now, the most viewed of all
        time, or the newest uploads — as a grid on larger screens or as a full-screen vertical feed on your phone.
      </p>
      <p className="leading-relaxed text-fg/90">
        Everyone depicted must be an adult who consented. Anyone can ask us to review or remove content using the button on every post or the{' '}
        <Link to="/report" className="text-flame-soft underline">report form</Link>.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link to="/" className="btn-primary">See what's trending</Link>
        <Link to="/legal/terms" className="btn-ghost">Terms</Link>
        <Link to="/legal/contact" className="btn-ghost">Contact</Link>
      </div>
    </article>
  );
}
