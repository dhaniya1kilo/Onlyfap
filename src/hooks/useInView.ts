import { useEffect, useRef, useState } from 'react';

/** Observe an element. `once` stops observing after the first hit. */
export function useInView<T extends Element>(options: IntersectionObserverInit & { once?: boolean } = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const [ratio, setRatio] = useState(0);
  const { once, root, rootMargin, threshold } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      setRatio(1);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        setRatio(entry.intersectionRatio);
        if (entry.isIntersecting && once) obs.disconnect();
      },
      { root, rootMargin, threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [once, root, rootMargin, JSON.stringify(threshold)]);

  return { ref, inView, ratio };
}
