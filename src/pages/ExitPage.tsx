import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

/** Neutral page shown after "No, exit". Contains no adult content or branding imagery. */
export default function ExitPage() {
  useSeo({ title: 'You have left', noindex: true });
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink px-6 text-center">
      <div className="max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">You chose not to enter</h1>
        <p className="text-sm leading-relaxed text-muted">
          This website is only for adults. You can close this tab now. If you arrived here by mistake and you are 18 or older, you can go back.
        </p>
        <Link to="/" className="btn-ghost">Go back to the age check</Link>
      </div>
    </div>
  );
}
