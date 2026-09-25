# OnlyFap

OnlyFap is an adults-only (18+) video and photo discovery platform. It has:

- a **Trending** home page (plus Most viewed, New and Old), ranked in Postgres
- a full-screen **vertical feed** on phones (swipe up/down, autoplay muted, tap to pause, double-tap to like)
- a grid layout, a large media viewer and a fullscreen mode on desktop
- search with **suggestions** (popular searches, popular tags, matching posts) and sorting
- **view counts**, **likes** (hearts) and related content
- a **Report / Request removal** flow on every post, with an admin review workflow, audit log and optional email replies
- an **age gate** before any content loads
- draft **legal pages**, compliance-record tracking and sandboxed **ads** after every 5 posts

> ⚠️ **Before going live:** the legal pages are *draft templates* and the age gate is a *self-declaration*, not formal age verification. See [Legal documents](#legal-document-placeholders) and [Age gate](#age-gate-configuration). Nothing in this project claims that you hold any licence, registration or certification.

---

## Technology stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite 5, Tailwind CSS 3, React Router 6, lucide-react |
| Backend | Supabase: Postgres (RLS, SQL functions), Auth, Storage, Edge Functions (email) |
| Hosting | Cloudflare Pages (static SPA) + Pages Functions (`sitemap.xml`, `robots.txt`, server-side meta for `/content/:id`) |

## Project layout

```
supabase/migrations/001_initial_schema.sql            base schema: profiles, content, tags, ads, search, storage
supabase/migrations/002_onlyfap_engagement_moderation.sql  views, likes, trending, search analytics,
                                                       removal requests, reports, audit log, compliance, settings
supabase/functions/removal-email/index.ts              Edge Function that sends removal-request emails
functions/                                             Cloudflare Pages Functions (sitemap, robots, content meta)
edge-lib/                                              shared code for those functions
src/lib            supabase client, site/legal config, age verification, anon id, labels, errors, captcha hook
src/services       content, likes, search, moderation, email, admin, tags, ads, storage
src/hooks          infinite lists, in-view, view tracking, SEO, media queries
src/components     layout, feed (vertical feed, cards, ads), media, engagement (like/share/report), admin, ui
src/content/legal.tsx                                  draft legal templates
src/pages          public pages and admin/*
public/            _redirects, _headers, favicon, manifest
```

---

## Installation & local development

Requirements: Node 20+, a Supabase project.

```bash
cp .env.example .env      # fill in at least VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
npm test                  # unit tests (ad insertion, media validation, formatting, age gate)
npm run typecheck         # TypeScript (app, Vite config, Cloudflare functions)
npm run build             # typecheck + production build into dist/
npm run preview           # serve dist/ locally
```

## Environment variables

All `VITE_*` variables are **public** (bundled into the browser). Never put secrets in them.

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase **anon** key (never the service_role key) |
| `VITE_SITE_URL` | recommended | Public origin, e.g. `https://onlyfap.example` (canonical URLs, sharing, sitemap) |
| `VITE_LEGAL_ENTITY_NAME`, `VITE_BUSINESS_ADDRESS`, `VITE_CONTACT_EMAIL`, `VITE_JURISDICTION_COUNTRY`, `VITE_DMCA_AGENT` | before launch | Fill the legal page placeholders |
| `VITE_AGE_GATE_DAYS` | no | Days the 18+ confirmation is remembered (default 30) |
| `VITE_AGE_GATE_EXIT_URL` | no | `https://` URL for “No, exit” (default: neutral `/exit` page) |
| `VITE_AGE_VERIFICATION_PROVIDER` | no | `self_declaration` (default) or a provider you add |
| `VITE_ENABLE_ANONYMOUS_LIKES` | no | `true` lets visitors like without an account (needs Supabase anonymous sign-ins) |
| `VITE_EMAIL_FUNCTION_ENABLED` | no | `true` after deploying the email Edge Function with provider secrets |

Server-side secrets (Supabase Edge Function secrets — **not** in `.env`):

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Email provider API key (Resend by default; swap the adapter for another provider) |
| `EMAIL_FROM` | Sender, e.g. `OnlyFap Moderation <moderation@yourdomain.example>` |
| `ADMIN_NOTIFY_EMAIL` | Optional: moderators are emailed about urgent requests |
| `SITE_URL` | Optional: public origin used in email links |

---

## Supabase setup

1. Create a project at supabase.com.
2. **SQL Editor → New query**: run `supabase/migrations/001_initial_schema.sql`, then `supabase/migrations/002_onlyfap_engagement_moderation.sql`.
   - Upgrading from the previous build? 001 is the same SQL you already ran (the file was only renamed), so run **002 only**.
   - With the Supabase CLI: `supabase link` then `supabase db push`.
3. **Authentication → URL Configuration**: set the Site URL and add your local and production URLs to Redirect URLs.
4. *(Optional)* **Authentication → Sign In / Providers → Anonymous sign-ins: ON** if you set `VITE_ENABLE_ANONYMOUS_LIKES=true`. Consider enabling CAPTCHA protection for auth there too.
5. **Project Settings → API**: copy the Project URL and the `anon` key into `.env`.
6. Migration 001 inserts seven generic starter categories (Technology, Gaming, …). Rename or delete them in **/admin/tags** and create your own.

### Database migrations (what 002 adds)

| Object | Purpose |
|---|---|
| `content.like_count`, `content.moderation_state`, `content.thumbnail_url` | counters, moderation (`active` / `under_review` / `hidden` / `removed`), video posters |
| `content_views` | de-duplicated view events (one per viewer per item per UTC day, hashed anonymous key) |
| `content_daily_stats` | per-day views/likes aggregates that power Trending |
| `content_likes` | one like per user per item (primary key prevents duplicates) |
| `search_queries` | anonymous search counts for suggestions (no user/IP/session stored) |
| `removal_requests` | removal/takedown requests — admin-only |
| `content_reports` | quick anonymous reports — admin-only |
| `moderation_actions` | audit log of every moderation decision — admin-only |
| `content_compliance` | consent / age-verification / ownership record *status + reference* — admin-only |
| `site_settings` | admin switches (auto-hide rules) |
| RPCs | `browse_content`, `search_content`, `search_suggestions`, `log_search`, `record_view`, `toggle_like`, `related_content`, `liked_content`, `submit_removal_request`, `submit_content_report`, `admin_set_content_state`, `admin_dashboard_stats`, `admin_list_users`, `prune_view_events` |

Both migrations are idempotent where practical and were tested on PostgreSQL 16 with Supabase-equivalent roles (`anon`, `authenticated`) and RLS.

### Storage setup

Migration 001 creates the public `content-media` bucket (50 MB limit, JPG/PNG/WEBP/MP4/WEBM) with **public read, admin-only write**. Video posters are captured in the browser at upload time and stored in the same bucket. For large libraries, put a CDN in front of Storage or move media to a video CDN; `media_url` can point to any public HTTPS URL (use **Upload → Paste link**).

### Admin setup

Sign up in the app, find your user UUID in **Authentication → Users**, then in the SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<your-user-uuid>';
```

There is no hardcoded admin. A trigger blocks role changes from the browser; every admin action is enforced by RLS or by an `is_admin()` check inside the SQL function. Admin pages: `/admin` (Dashboard), Content, Upload, Tags, Ads, Users, Removal requests, Reports, Settings.

---

## Email configuration

Emails are sent **only** by the Edge Function `supabase/functions/removal-email` — the provider key never reaches the browser.

```bash
supabase functions deploy removal-email
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="OnlyFap Moderation <moderation@yourdomain.example>"
supabase secrets set ADMIN_NOTIFY_EMAIL=moderators@yourdomain.example SITE_URL=https://onlyfap.example   # optional
```

Then set `VITE_EMAIL_FUNCTION_ENABLED=true` and redeploy the site.

- **acknowledge**: after a removal request is submitted, the requester gets one confirmation email with their reference (only once, only within 1 hour of submission).
- **respond**: admins reply from **/admin/removal-requests/:id**; the function re-checks the caller is an admin.
- If the provider is not configured, the function returns `{ sent: false, reason: "not_configured" }`. The UI then says plainly that **no email was sent**, requests are still stored, and admins get a “Reply from your mail app” (mailto) button instead.

To use another provider (Postmark, SES, SendGrid…), replace `sendEmail()` in the function.

---

## Removal-request workflow

```
User submits request (post button or /report)
  → stored in removal_requests (validated, de-duplicated, rate-limited) + reference shown
  → post marked "under_review" (still visible) — optional auto-hide for urgent reasons
  → admin reviews in /admin/removal-requests (content preview, requester email, details, history)
  → admin decides: keep / hide / delete content
  → status + outcome + private notes saved; every action written to moderation_actions
  → requester is emailed (Edge Function) or answered from the admin's mail app
```

- Content is **never deleted automatically**. Urgent reasons (person depicted, consent, possible minor) are prioritised; **Settings → Hide content while an urgent removal request is reviewed** turns on temporary auto-hide (off by default, because anyone can submit a request).
- `admin_notes` live in an admin-only table and are never shown or emailed to requesters.
- Quick reports (no email) go to **/admin/reports**; an optional threshold auto-hides posts after N serious reports.
- For suspected child sexual abuse material: hide immediately, do not download/share, preserve records as advised by counsel and report to the authorities (e.g. NCMEC CyberTipline, IWF). The admin screen shows this guidance.

## Adult-content compliance structure

This project provides *structure*, not legal compliance. It includes:

| Area | Where |
|---|---|
| Age restriction for viewers | age gate (`src/components/AgeGate.tsx`) + provider interface for real verification |
| Consent documentation, performer age/ID verification, ownership | **Edit content → Compliance records** (`content_compliance`: status + reference to the custodian’s records; no ID documents are stored) |
| Copyright complaints, removal and privacy requests | removal request form, admin workflow, audit log |
| Prohibited content reporting | quick reports + urgent handling |
| Record retention | `moderation_actions` keeps decisions; `prune_view_events()` trims raw analytics (schedule with pg_cron) |
| Jurisdiction-specific age verification | `src/lib/ageVerification.ts` — see below |

The dashboard shows how many posts are missing compliance records. Consult a lawyer about record-keeping obligations (for example 18 U.S.C. § 2257 in the US) where they apply to you.

## Age gate configuration

- Shown before anything else; site content is not mounted and no content is fetched until the visitor confirms.
- **Yes** stores the acceptance in `localStorage` for `VITE_AGE_GATE_DAYS` days. **No** goes to a neutral `/exit` page (or `VITE_AGE_GATE_EXIT_URL`).
- Visitors can reset it from the footer (**Reset age confirmation**) or the account page.
- Legal pages (`/legal/*`) and `/exit` stay reachable without passing the gate.
- **The default is a self-declaration, not formal age verification**, and does not by itself satisfy laws that require verified age checks (for example in some US states, the UK or France). To add a real provider, implement `AgeVerificationProvider` in `src/lib/ageVerification.ts`, verify the provider’s result **server-side** (Pages Function / Edge Function), and decide which visitors need it server-side (e.g. Cloudflare `CF-IPCountry`).

## Legal document placeholders

`/legal/terms`, `/legal/privacy`, `/legal/copyright`, `/legal/content-removal`, `/legal/age-policy`, `/legal/consent-policy`, `/legal/acceptable-use`, `/legal/contact` and `/report` are linked in the footer.

- They are **draft templates** (`src/content/legal.tsx`, `LEGAL_DRAFT = true`) and show a visible draft notice.
- Unfilled details render as `[LEGAL ENTITY NAME]`, `[BUSINESS ADDRESS]`, `[CONTACT EMAIL]`, `[COUNTRY]`, `[DMCA AGENT DETAILS IF APPLICABLE]` and similar tokens.
- **You must have every document reviewed by a qualified lawyer** for the countries you operate in before publishing them as final terms. After review: fill the `VITE_LEGAL_*` variables, edit the text, and set `LEGAL_DRAFT = false`.
- The templates do not claim any licence, permit, registration, certification or legal approval.

---

## How key pieces work

**Trending.** `browse_content('trending')` ranks public posts by `trending_score()`:
`recent = views(last 2 days) + 0.35 × views(days 3–7) + 3 × likes(7 days)`,
`score = (recent + 1 + ln(1 + lifetime views)) / (min(age_hours, 336) + 2)^0.6`.
A new post gaining views quickly beats an old post with a big lifetime total. **Most viewed** = lifetime `view_count`, **New** = `created_at desc`, **Old** = `created_at asc`. All ordering and pagination happen in Postgres with indexes; the browser never downloads the table. For very large catalogues, precompute the score with pg_cron into a column.

**Views.** A view is recorded only after the media has been on screen for 2 seconds (`useViewTracker`), once per tab/session, and the database counts at most one view per viewer per item per UTC day. The viewer key is a random browser token (or the user id), stored only as a SHA-256 hash. A viewer registering >120 views in 10 minutes is ignored. `content_views` is ready for richer analytics later.

**Likes.** `toggle_like()` inserts/deletes one row per user (primary key prevents duplicates; RLS allows only your own likes); a trigger maintains `like_count`. Rate limit: 60 new likes per user per 5 minutes. Without an account, likes use a Supabase anonymous session if enabled; otherwise the visitor is asked to log in.

**Search.** `search_content()` searches title, description (weighted full-text + trigram) and tag names, sortable by relevance, most viewed, newest, oldest, with a media-type filter and offset pagination. Suggestions (`search_suggestions()`) combine popular searches (only queries searched ≥3 times that return results; admins can block any), popular tags and matching titles. Recent searches are stored only on the device.

**Ads every 5 posts, global across pages.** `insertAdsIntoFeed()` runs over the full accumulated list, so posts #5, #10, #15… are always followed by an ad regardless of page boundaries (vertical feed and grids). HTML/embed ads render only in `<iframe sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc>` without `allow-same-origin`. Do not add a strict `script-src` CSP, since srcdoc iframes inherit it.

**Mobile vs desktop.** Below 768 px the home and content pages use the full-screen vertical feed with a bottom navigation bar. Wider screens get a header with navigation, a card grid, a large viewer with a fullscreen button, and an optional `/feed` immersive mode.

**Performance.** Only visible/nearby videos get a `src`; far-away feed videos are unmounted; next pages prefetch while ~3 posts remain; cards use poster images; admin and secondary pages are code-split; hashed assets are cached for a year (`public/_headers`).

**SEO.** Per-page titles, descriptions, canonical URLs, Open Graph/Twitter tags and JSON-LD (`WebSite`, `VideoObject`/`ImageObject`) via `useSeo`. The Pages Function `functions/content/[id].ts` injects real meta tags for crawlers and link previews; `functions/sitemap.xml.ts` lists public posts and tag pages; `functions/robots.txt.ts` points to it. Admin, account, search-result and draft legal pages are `noindex`. The site labels itself as adult (`<meta name="rating" content="adult">`, and the free RTA self-label header in `public/_headers`, which you may remove).

---

## Production build & Cloudflare Pages deployment

Connect the repository in **Workers & Pages → Create → Pages**:

| Setting | Value |
|---|---|
| Framework preset | Vite (or None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | all `VITE_*` values above (Production and Preview) |
| Node version | `NODE_VERSION=20` if needed |

The `functions/` directory is deployed automatically as Pages Functions (they read `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SITE_URL` at runtime — public values only). `public/_redirects` sends every other path to `index.html`.

CLI alternative: `npm run build && npx wrangler pages deploy dist --project-name onlyfap`.

After deploying, add the production URL to Supabase Auth redirect URLs.

---

## Security notes

See `docs/SECURITY_REVIEW.md` for the full review and `docs/LAUNCH_CHECKLIST.md` for go-live steps. In short:

- Only the anon key is in the frontend. No service_role key, email key or other secret is referenced anywhere in `src/` or `functions/`.
- RLS is enabled on every table. Removal requests, reports, audit log, compliance records, settings, raw views and search analytics are **admin-only**; public submissions go through validated, rate-limited `SECURITY DEFINER` functions with fixed `search_path`.
- Users can only create/delete their own likes and can never change view counts, like counts, roles or analytics.
- No `dangerouslySetInnerHTML`; ads are sandboxed; JSON-LD is set as text; server-side meta tags are escaped.
- Anti-abuse: view de-duplication and velocity cap, like rate limit, per-browser/per-email/global limits and duplicate detection for requests and reports, honeypot field, admin block list for search suggestions. A CAPTCHA integration point is documented in `src/lib/captcha.ts`.

## Testing

- `npm test` — unit tests (Vitest).
- `npm run typecheck` / `npm run build`.
- The SQL was verified on PostgreSQL 16 with Supabase-like roles: RLS on every new table, view de-duplication, trending vs most-viewed ordering, likes, search, suggestions, removal requests (duplicates, validation, rate limits, auto-hide), admin-only reads and the audit log.
