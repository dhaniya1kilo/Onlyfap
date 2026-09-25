import { useEffect } from 'react';
import { useInView } from '../../hooks/useInView';

/** Invisible trigger near the bottom of a list for infinite scroll. */
export function Sentinel({ onVisible, disabled }: { onVisible: () => void; disabled?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: '800px 0px' });
  useEffect(() => {
    if (inView && !disabled) onVisible();
  }, [inView, disabled, onVisible]);
  return <div ref={ref} aria-hidden="true" className="h-px w-full" />;
}
