import { useEffect, useState } from 'react';

/** Tiny global toast: call toast('Link copied') from anywhere. */
type Msg = { id: number; text: string };
let push: ((text: string) => void) | null = null;
let seq = 0;

export function toast(text: string) {
  push?.(text);
}

export function Toaster() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  useEffect(() => {
    push = (text) => {
      const id = ++seq;
      setMsgs((m) => [...m.slice(-2), { id, text }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 3200);
    };
    return () => { push = null; };
  }, []);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {msgs.map((m) => (
        <p key={m.id} className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-ink shadow-xl shadow-black/40">
          {m.text}
        </p>
      ))}
    </div>
  );
}
