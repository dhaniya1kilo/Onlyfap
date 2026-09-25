import { useEffect } from 'react';
import { SITE, absoluteUrl } from '../lib/site';

export interface SeoOptions {
  title?: string;
  description?: string;
  /** Path (e.g. /content/123) or absolute URL. Defaults to the current path without query. */
  canonical?: string;
  image?: string | null;
  type?: 'website' | 'video.other' | 'article';
  /** Keep private or thin pages out of search indexes. */
  noindex?: boolean;
  /** schema.org JSON-LD object. Rendered as data via textContent, never as HTML. */
  jsonLd?: Record<string, unknown> | null;
}

function setMeta(attr: 'name' | 'property', key: string, value: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (value === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

/**
 * Per-page title, description, canonical, Open Graph / Twitter tags and
 * optional JSON-LD. Crawlers that do not run JavaScript get server-side tags
 * for /content/:id from functions/content/[id].ts (Cloudflare Pages).
 */
export function useSeo(opts: SeoOptions = {}) {
  const { title, description, canonical, image, type = 'website', noindex = false, jsonLd } = opts;
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const fullTitle = title ? `${clip(title, 70)} | ${SITE.name}` : `${SITE.name} — Trending adult videos (18+)`;
    const desc = clip(description || SITE.description, 160);
    const url = canonical
      ? /^https?:\/\//.test(canonical) ? canonical : absoluteUrl(canonical)
      : absoluteUrl(window.location.pathname);
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setLink('canonical', url);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:image', image ? absoluteUrl(image) : null);
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);

    let script = document.getElementById('ld-json') as HTMLScriptElement | null;
    if (ld) {
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'ld-json';
        document.head.appendChild(script);
      }
      script.textContent = ld; // JSON string, set as text (no HTML parsing)
    } else {
      script?.remove();
    }
  }, [title, description, canonical, image, type, noindex, ld]);
}
