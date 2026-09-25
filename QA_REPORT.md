# OnlyFap — QA report for this build

## What was run

| Check | Result |
|---|---|
| TypeScript `tsc -b` (app, Vite config, Cloudflare functions), strict mode | ✅ passes |
| Unit tests (ad insertion, media validation, formatting/sort params, age gate) | ✅ 22/22 |
| Migrations 001 → 002 applied to PostgreSQL 16 with Supabase-equivalent roles, twice (idempotency) | ✅ |
| SQL/RLS tests: anon/user/admin visibility, view de-dup, trending vs most-viewed, likes + RLS, search + sorting, suggestions, removal requests (validation, duplicates, rate limits, auto-hide), admin-only tables, role escalation blocked, audit log | ✅ all pass |
| Browser end-to-end (Chromium, 360/390/414/768/1366 px) against the real schema and RLS | ✅ 59/59 checks, 0 console errors |

End-to-end checks covered: age gate (shown first, no content behind it, Yes/No, persistence), trending order, view counted after 2 s and persisted, no double count, muted autoplay, tap to pause, like/unlike stored with counts, ad after every 5 posts with the global counter across pages (feed and desktop grid), Most viewed/New/Old tabs, removal request (validation, reference, stored, content under review, no false “email sent” claim), search suggestions (popular searches ≥3, tags, matching posts), search sorting and anonymous logging, mobile vertical content viewer, legal draft pages with placeholders, no horizontal overflow, desktop grid/viewer/related/JSON-LD/canonical, sandboxed HTML ad cannot touch the page, non-admin blocked from /admin and from reading removal requests, admin dashboard, hide content, resolve request with private notes, audit log, admin content filters, users page, compliance record save.

Bugs found and fixed during testing: trending ignored recent velocity for anonymous visitors (stats table was admin-only → added a definer aggregate function); an auth race could bounce admins to “denied” right after login or on reload; the search box’s log call was never sent (lazy query builder); iframe ads showed a white background in dark mode; small-screen feed tabs were clipped.

## Environment limitation (please run locally)

The build sandbox could not reach the npm registry, so `npm install` / `vite build` / `vitest` could not be executed with the real packages. Type checking used faithful type stubs for React, React Router, lucide-react and supabase-js, and the browser tests used a bundle built with esbuild + Tailwind plus a test adapter that forwards supabase-js calls to PostgreSQL. Run these once on your machine or CI:

```bash
npm install && npm test && npm run build
```

Also not executable here: the Supabase Edge Function (Deno) and Cloudflare Pages Functions runtime. Both are small and type-checked where possible; verify them after deploying (see `LAUNCH_CHECKLIST.md`).
