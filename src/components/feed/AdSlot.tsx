import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Ad } from '../../types';
import { isSafeHttpUrl } from '../../utils/format';
import { ErrorBoundary } from '../ui/ErrorBoundary';

/**
 * SECURITY MODEL
 * - HTML/embed ads render ONLY inside <iframe sandbox srcdoc>.
 * - The sandbox omits `allow-same-origin`, so the ad runs in an opaque
 *   origin: it cannot read this app's localStorage (Supabase session),
 *   cookies, DOM, or JS state, and cannot navigate the top window.
 * - The only channel back is postMessage carrying a numeric height, which
 *   we accept only from this exact iframe window and clamp.
 * - Link ads are plain anchors with validated http(s) URLs.
 */
const SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

function buildSrcDoc(inner: string, nonce: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><base target="_blank">
<style>:root{color-scheme:dark}html,body{margin:0;padding:0;background:transparent;color:#F6F4FA;font-family:system-ui,sans-serif;overflow:hidden}img,iframe,video{max-width:100%}</style></head>
<body><div id="ds-ad">${inner}</div>
<script>(function(){var n=${JSON.stringify(nonce)};function s(){try{parent.postMessage({dsAd:n,h:Math.ceil(document.getElementById('ds-ad').getBoundingClientRect().height)},'*')}catch(e){}}
window.addEventListener('load',s);new ResizeObserver(s).observe(document.getElementById('ds-ad'));setTimeout(s,50);setTimeout(s,1500)})();</script></body></html>`;
}

function SandboxedAd({ ad, onFail }: { ad: Ad; onFail: () => void }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const nonce = useMemo(() => crypto.randomUUID(), []);
  const [height, setHeight] = useState(250);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { dsAd?: string; h?: unknown };
      if (!d || d.dsAd !== nonce || typeof d.h !== 'number' || !Number.isFinite(d.h)) return;
      setHeight(Math.min(Math.max(Math.round(d.h), 60), 900));
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [nonce]);

  return (
    <iframe
      ref={frame}
      title={ad.label || 'Advertisement'}
      sandbox={SANDBOX}
      srcDoc={buildSrcDoc(ad.ad_content, nonce)}
      referrerPolicy="no-referrer"
      loading="lazy"
      className="block w-full border-0 bg-transparent [color-scheme:dark]"
      style={{ height }}
      onError={onFail}
    />
  );
}

function LinkAd({ ad }: { ad: Ad }) {
  const url = new URL(ad.ad_content);
  return (
    <a
      href={url.toString()}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="flex items-center justify-between gap-4 p-5 hover:bg-ink-3"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold">{ad.label || url.hostname}</p>
        <p className="truncate text-sm text-muted">{url.hostname}</p>
      </div>
      <span className="btn-primary shrink-0">
        Visit <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </span>
    </a>
  );
}

/** Can this ad be rendered safely at all? Invalid ads are skipped, not shown blank. */
export function isRenderableAd(ad: Ad): boolean {
  if (!ad.ad_content.trim()) return false;
  if (ad.ad_type === 'link') return isSafeHttpUrl(ad.ad_content);
  return ad.ad_type === 'html' || ad.ad_type === 'embed';
}

function AdInner({ ad, onFail }: { ad: Ad; onFail: () => void }) {
  if (ad.ad_type === 'link') return <LinkAd ad={ad} />;
  return <SandboxedAd ad={ad} onFail={onFail} />;
}

/** One ad placement. Renders nothing if the ad is invalid or crashes. */
export function AdSlot({ ad, className = '' }: { ad: Ad; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !isRenderableAd(ad)) return null;
  return (
    <ErrorBoundary fallback={null}>
      <aside aria-label="Advertisement" className={`panel overflow-hidden ${className}`}>
        <p className="border-b border-ink-line px-4 py-1.5 text-[11px] text-muted">Sponsored</p>
        <AdInner ad={ad} onFail={() => setFailed(true)} />
      </aside>
    </ErrorBoundary>
  );
}
