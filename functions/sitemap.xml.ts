import { type Ctx, siteOrigin, supabaseGet, xmlEscape } from '../edge-lib/env';

interface Row { id: string; updated_at: string }
interface TagRow { slug: string }

/**
 * GET /sitemap.xml — generated at the edge from PUBLIC content only (anon
 * key + RLS), cached for an hour. Lists real pages only; no doorway pages.
 */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(new URL('/sitemap.xml', ctx.request.url).toString());
  const hit = cache ? await cache.match(cacheKey) : undefined;
  if (hit) return hit;

  const origin = siteOrigin(ctx.env, ctx.request);
  const [content, tags] = await Promise.all([
    supabaseGet<Row[]>(ctx.env, 'content_feed?select=id,updated_at&order=created_at.desc&limit=45000'),
    supabaseGet<TagRow[]>(ctx.env, 'tags?select=slug&order=slug&limit=2000'),
  ]);

  const urls: string[] = [];
  const add = (path: string, lastmod?: string, priority?: string) =>
    urls.push(
      `<url><loc>${xmlEscape(origin + path)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod.slice(0, 10))}</lastmod>` : ''}${priority ? `<priority>${priority}</priority>` : ''}</url>`,
    );

  add('/', undefined, '1.0');
  add('/?sort=most-viewed', undefined, '0.7');
  add('/?sort=new', undefined, '0.7');
  add('/about', undefined, '0.3');
  add('/report', undefined, '0.3');
  for (const t of tags ?? []) add(`/search?tag=${encodeURIComponent(t.slug)}`, undefined, '0.5');
  for (const c of content ?? []) add(`/content/${c.id}`, c.updated_at, '0.8');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  const res = new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
  if (cache && content) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
