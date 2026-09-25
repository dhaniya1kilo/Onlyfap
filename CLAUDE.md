# OnlyFap — notes for coding assistants

This repo contains a full implementation. Verify, fix and extend it; don't rebuild it.

## Product
OnlyFap: an adults-only (18+) media discovery platform. Trending/Most viewed/New/Old discovery, search with suggestions, a full-screen vertical feed on phones, grid + large viewer on desktop, views, likes, report/removal requests with an admin workflow, compliance-record tracking, draft legal pages, sandboxed ads. Brand name is always "OnlyFap".

## Stack (keep)
React 18, TypeScript (strict), Vite 5, Tailwind 3, Supabase JS v2, React Router 6, lucide-react. Cloudflare Pages (static SPA) + Pages Functions in `functions/`. Email via the Supabase Edge Function `supabase/functions/removal-email`.

## Invariants — do not break
- Ads are inserted by `insertAdsIntoFeed()` after every 5 CONTENT items over the full accumulated list (global counter across pagination). Ads never go in `content`. Keep `src/utils/insertAds.test.ts` passing.
- HTML/embed ads render only in a sandboxed `srcdoc` iframe WITHOUT `allow-same-origin`. Never use `dangerouslySetInnerHTML`.
- Ordering, search, trending, suggestions, related content and counts run in Postgres (RPCs). Never fetch whole tables and sort/filter in JS.
- Admin rights come from `profiles.role` + RLS/`is_admin()`. Never add the service_role key or any secret to frontend code or Pages Functions.
- Private tables (removal_requests, content_reports, moderation_actions, content_compliance, site_settings, content_views, content_daily_stats, search_queries) stay admin-only; public writes go through validated SECURITY DEFINER functions.
- Views are recorded only via `useViewTracker` → `record_view()`; never on render.
- Removal requests never delete content automatically.
- The age gate must render before any content is fetched; never describe it as formal age verification.
- Legal pages stay marked as drafts until the owner confirms legal review; never invent licences, registrations or certifications.

## Commands
`npm install` · `npm run dev` · `npm test` · `npm run typecheck` · `npm run build`

## Database
`supabase/migrations/001_initial_schema.sql` then `002_onlyfap_engagement_moderation.sql`. For schema changes add `003_*.sql`; don't edit applied migrations.
