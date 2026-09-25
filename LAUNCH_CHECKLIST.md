# OnlyFap — launch checklist

Work through these against your real Supabase project and Cloudflare deployment.

## 1. Install and build
- [ ] `npm install`, `npm test`, `npm run typecheck`, `npm run build` all pass.

## 2. Supabase
- [ ] Ran `001_initial_schema.sql` then `002_onlyfap_engagement_moderation.sql` (existing projects: 002 only).
- [ ] Auth Site URL and Redirect URLs set for local + production.
- [ ] Signed up and promoted your account to admin (README → Admin setup).
- [ ] Replaced the generic starter categories in /admin/tags.
- [ ] (Optional) Anonymous sign-ins enabled if `VITE_ENABLE_ANONYMOUS_LIKES=true`.
- [ ] (Optional) pg_cron job for `prune_view_events(90)`.

## 3. Smoke test (real project)
- [ ] Age gate appears; "No, exit" goes to /exit; "Yes" enters; footer reset brings it back.
- [ ] Upload one image and one MP4/WEBM (video gets a poster frame); record compliance status on the edit page.
- [ ] Home: Trending / Most viewed / New / Old; phone shows the vertical feed; desktop shows the grid.
- [ ] Watching a post for 2+ seconds increments its view count once per day.
- [ ] Like/unlike works (logged in, or as guest if enabled).
- [ ] Search suggestions appear; results sort by relevance / most viewed / newest / oldest.
- [ ] Ads appear after every 5 posts, including across page loads.
- [ ] Submit a removal request → reference shown → it appears in /admin/removal-requests → hide content → resolve with a note.
- [ ] A non-admin cannot open /admin and receives no rows from removal_requests.

## 4. Email (optional)
- [ ] `supabase functions deploy removal-email`, secrets `RESEND_API_KEY`, `EMAIL_FROM` set, sender domain verified with the provider.
- [ ] `VITE_EMAIL_FUNCTION_ENABLED=true`, redeployed; acknowledgement and admin reply emails received.

## 5. Legal and compliance (owner responsibility)
- [ ] All legal pages reviewed by a qualified lawyer for your markets; placeholders filled; `LEGAL_DRAFT = false`.
- [ ] Decide which jurisdictions require formal age verification and integrate a provider (server-verified).
- [ ] Custodian of records and consent/ID verification process in place outside this app.
- [ ] Process for reporting illegal content to the authorities.

## 6. Deploy
- [ ] Cloudflare Pages: build `npm run build`, output `dist`, all `VITE_*` variables set for Production and Preview.
- [ ] `/sitemap.xml`, `/robots.txt` and a shared `/content/<id>` link preview show correct data.
- [ ] Production URL added to Supabase Auth redirect URLs.
