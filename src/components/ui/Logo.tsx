import { useId } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '../../lib/site';

/**
 * Original OnlyFap mark: a flame→velvet rounded tile holding an open ring
 * (the "O") with a play notch. Drawn from scratch for this project.
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`of-g-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF7093" />
          <stop offset="0.5" stopColor="#E11D48" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#of-g-${gid})`} />
      <path
        d="M44.5 22.6A15 15 0 1 0 47 32"
        fill="none"
        stroke="#fff"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <path d="M28.5 25.5v13l10.5-6.5z" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold leading-none tracking-tight ${className}`}>
      <span className="text-fg">Only</span>
      <span className="brand-gradient-text">Fap</span>
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label={`${SITE.name} home`}>
      <LogoMark />
      {!compact && <Wordmark className="text-[1.4rem]" />}
    </Link>
  );
}
