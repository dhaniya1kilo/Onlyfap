import { type Ctx, siteOrigin, supabaseGet } from '../../edge-lib/env';

interface Row {
  id: string;
  title: string;
  description: string;
  media_type: 'image' | 'video';
  media_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clip(s: string, n: number) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * GET /content/:id — serves the SPA with real <title>, description,
 * canonical and Open Graph tags for crawlers and link previews that do not
 * run JavaScript. Hidden/unpublished posts are invisible to the anon key
 * (RLS), so they get a 404 status and no metadata.
 */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const id = String(ctx.params.id ?? '');
  // Fetch the SPA shell from '/' (Pages redirects /index.html → /).
  const shell = await ctx.env.ASSETS.fetch(new URL('/', ctx.request.url).toString());
  if (!UUID.test(id)) return new Response(shell.body, { status: 404, headers: shell.headers });

  let rows: Row[] | null = null;
  try {
    rows = await supabaseGet<Row[]>(
      ctx.env,
      `content_feed?select=id,title,description,media_type,media_url,thumbnail_url,created_at&id=eq.${id}&limit=1`,
    );
  } catch {
    rows = null;
  }
  if (rows === null) return shell; // Supabase unreachable → plain SPA, client handles it
  const item = rows[0];
  if (!item) return new Response(shell.body, { status: 404, headers: shell.headers });

  const origin = siteOrigin(ctx.env, ctx.request);
  const url = `${origin}/content/${item.id}`;
  const title = `${clip(item.title, 70)} | OnlyFap`;
  const desc = clip(item.description || item.title, 160);
  const image = item.thumbnail_url ?? (item.media_type === 'image' ? item.media_url : null);

  const setMeta = (attr: 'name' | 'property', key: string, value: string) => ({
    element(el: { setAttribute: (k: string, v: string) => void }) {
      el.setAttribute(attr, key);
      el.setAttribute('content', value);
    },
  });

  const rewriter = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute('content', desc); } })
    .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', desc); } })
    .on('meta[property="og:type"]', { element(el) { el.setAttribute('content', item.media_type === 'video' ? 'video.other' : 'article'); } })
    .on('head', {
      element(el) {
        // setAttribute/append with html:false escape values; nothing user-controlled is injected as raw HTML.
        el.append(`<link rel="canonical" href="${url.replace(/"/g, '&quot;')}">`, { html: true });
        el.append(`<meta property="og:url" content="${url.replace(/"/g, '&quot;')}">`, { html: true });
      },
    });
  if (image && /^https?:\/\//i.test(image)) {
    rewriter.on('meta[name="twitter:card"]', setMeta('name', 'twitter:card', 'summary_large_image'));
    rewriter.on('head', {
      element(el) {
        el.append(`<meta property="og:image" content="${image.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">`, { html: true });
      },
    });
  }

  const res = rewriter.transform(shell);
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(res.body, { status: 200, headers });
}
