import { type Ctx, siteOrigin } from '../edge-lib/env';

/** GET /robots.txt — absolute Sitemap URL for whichever domain serves the site. */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const origin = siteOrigin(ctx.env, ctx.request);
  const body = [
    '# OnlyFap — adult content (18+)',
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /account',
    'Disallow: /liked',
    'Disallow: /login',
    'Disallow: /signup',
    'Disallow: /exit',
    'Disallow: /feed',
    'Disallow: /search?q=',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
