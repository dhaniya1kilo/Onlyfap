# OnlyFap — security review

Scope: frontend (`src/`), Cloudflare Pages Functions (`functions/`, `edge-lib/`), Supabase schema and RLS (`supabase/migrations/`), Edge Function (`supabase/functions/removal-email`).

## Authentication & authorization

| Check | Result |
|---|---|
| Admin rights | `profiles.role = 'admin'`, checked by `is_admin()` (SECURITY DEFINER, fixed `search_path`). Frontend guards are UX only. |
| Role escalation | `protect_profile_role` trigger rejects role/id changes from `anon`/`authenticated`. Anonymous sessions are never treated as admin in the UI. |
| Login redirect | `next` accepts only same-site relative paths (no open redirect). |
| Auth race | Session and profile are applied together, so guards never act on a half-loaded session. |

## Row Level Security (every table has RLS enabled)

| Table | Public | Signed-in user | Admin |
|---|---|---|---|
| content | read public (published and not hidden/removed) | same | all |
| content_likes | — | read/insert/delete **own** rows only (insert only on public content) | read |
| content_views, content_daily_stats | — (written only by definer functions) | — | read |
| search_queries | — (suggestions via `search_suggestions()` only) | — | read/update/block |
| removal_requests | — (submit via `submit_removal_request()` only) | — | read/update/delete |
| content_reports | — (submit via `submit_content_report()` only) | — | read/update/delete |
| moderation_actions | — | — | read (written by triggers/definer functions) |
| content_compliance | — | — | full |
| site_settings | — | — | full |

`admin_notes` and requester emails are therefore unreadable to anyone but admins (verified: a signed-in non-admin receives zero rows; `anon` gets `permission denied`).

Function grants: Supabase grants EXECUTE on new functions to `anon`/`authenticated` by default, so migration 002 revokes and re-grants explicitly. Admin functions additionally check `is_admin()` internally.

## Integrity of counters

- `view_count` is changed only by `record_view()` (one view per viewer/item/day, velocity cap, public content only). The old unlimited `increment_view()` RPC was dropped.
- `like_count` is changed only by a trigger on `content_likes`.
- Users cannot update `content` at all (admin-only policy).
- `log_search()` computes result counts itself and ignores the client value; suggestions require ≥3 searches with results; admins can block queries.

## Storage

`content-media`: public read, admin-only insert/update/delete, MIME allow-list and 50 MB limit enforced by Supabase. Uploads use the admin's own JWT (no service key). Identity/consent documents must **not** be stored here; `content_compliance` stores only a reference.

## XSS / injection

- No `dangerouslySetInnerHTML` or `innerHTML` anywhere in `src/`.
- Ads: HTML/embed code runs only in a sandboxed `srcdoc` iframe **without** `allow-same-origin`; the only accepted message is a numeric height from that exact frame with a per-slot nonce. Link ads use validated http(s) URLs with `rel="sponsored noopener noreferrer"`.
- JSON-LD is assigned via `textContent`.
- Pages Function meta injection uses HTMLRewriter `setAttribute`/`setInnerContent` (escaped); the only raw HTML appended is built from a validated UUID and an escaped image URL.
- SQL: all browser queries go through supabase-js/PostgREST (parameterised); SQL functions use typed parameters and escape LIKE patterns (`_like_escape`).

## Secrets

- Only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (public by design) reach the browser.
- Email provider key and the service role key live only in Edge Function secrets. `.env` is git-ignored; `.env.example` contains no values.

## Abuse prevention

| Vector | Mitigation |
|---|---|
| Fake views | per-viewer/day de-duplication, 2-second on-screen threshold, >120 views/10 min ignored, hashed keys |
| Like spam | one like per user per item, 60 likes / 5 min / user, Supabase rate-limits anonymous sign-ins |
| Removal-request spam | 5/hour per browser, 20/day per email, 300/10 min global, duplicate detection, honeypot, good-faith confirmation, length limits |
| Report spam | one report per browser per post, 20/hour per browser |
| Weaponised takedowns | requests never delete content; auto-hide is opt-in; every action is audited |
| Email abuse | acknowledgement only once per request and only within 1 hour; replies require admin JWT |

A determined attacker can rotate anonymous browser tokens. For stronger protection add a CAPTCHA verified server-side (see `src/lib/captcha.ts`) and/or Cloudflare rate-limiting / WAF rules on the Supabase API route.

## Headers

`public/_headers`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS, COOP, long-lived caching for hashed assets. A strict `script-src` CSP is intentionally not set because sandboxed srcdoc ad frames inherit it.

## Residual risks / owner actions

1. The age gate is a self-declaration; add formal age verification where the law requires it.
2. Legal pages are drafts; have them reviewed by a lawyer.
3. Configure Supabase Auth rate limits / CAPTCHA and consider Cloudflare WAF rules.
4. Keep compliance records with a proper custodian outside this app.
