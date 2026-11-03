---
last_mapped_commit: 3b3ec17d9ff5204ecb014376389f129395489040
last_mapped_at: 2026-11-03
---
# External Integrations

**Analysis Date:** 2026-11-03

## APIs & External Services

**Advertising / Monetization:**
- Google AdSense - consent-gated display ads on the marketing site and the app under `/play/`
  - Client: publisher id `ca-pub-6409516653999633` (constant `ADSENSE_CLIENT` in `packages/website/src/consent.mjs` and `packages/app/src/monetization/monetization.ts`/`AdBanner.tsx`)
  - Loader script: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=...`, injected only after consent (`packages/website/src/consent.mjs` line 63)
  - Google Consent Mode v2 (`gtag('consent', ...)`) with regional defaults (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) — `packages/website/src/consent.mjs`
  - `ads.txt` emitted at build: `google.com, pub-6409516653999633, DIRECT, f08c47fec0942fa0` (`packages/website/src/build.mjs` line 664)

- Google Play Billing (Digital Goods API) - one-time lifetime "Remove Ads" in-app purchase, `$2.99` USD (`packages/app/src/monetization/monetization.ts`)
  - Method: `https://play.google.com/billing` via `window.getDigitalGoodsService()` / Payment Request API
  - SKU: `remove_ads`; only active inside Android Trusted Web Activity / Chrome PWA

**No other runtime APIs detected.** The solver, generator, and "AI Coach" are deterministic and run locally (`packages/app/src/aiCoach.ts` builds on `@hodoku/core`); no LLM or remote backend is called. No `fetch()`/`XMLHttpRequest` to external hosts in `packages/core` or `packages/app` (only the service worker's same-origin caching in `packages/app/public/sw.js`).

## Data Storage

**Databases:**
- None. No server-side database. All state is client-side browser storage.

**File Storage:**
- Local filesystem only (build-time). No cloud object storage.

**Caching:**
- Browser Cache Storage API via service worker (`packages/app/public/sw.js`, cache name `hodoku-v2`, max 150 entries, network-first for pages, cache-first for hashed assets)
- `localStorage` for app state: settings, saved games, library, history, save points (`packages/app/src/storage.ts`, `packages/app/src/hooks/useCollections.ts`) and ad-free entitlement (`revisited_ad_free_v1`) and consent choice (`hodoku-consent`)

## Authentication & Identity

**Auth Provider:**
- None. No accounts, no login. The only gate is the optional pre-release password gate: a salted SHA-256 check embedded client-side (`packages/website/src/gate.mjs`), explicitly not real access control (files remain fetchable by URL; docs point to Cloudflare Access for real protection).

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, no error-reporting SDK. Errors are `console.warn`/`console.error` only (e.g. `packages/app/src/monetization/useMonetization.ts`).

**Logs:**
- Build-time `console.log`/`console.warn` in the website generator (`packages/website/src/build.mjs`). No production log aggregation.

**Analytics:**
- None of its own. `analytics_storage` in Google Consent Mode is always `denied`; the site states "uses no analytics of its own" (`packages/website/src/build.mjs` privacy page).

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages - https://hodokurevisited.com/ (`packages/website/dist` deployed by `.github/workflows/pages.yml` using `cloudflare/wrangler-action@v3`, `pages deploy packages/website/dist --project-name=hodoku-revisited --branch=main`)
  - `accountId: 6c9d1596276c79e822640d0a8d429c60` (in `pages.yml`)
  - Custom domain `hodokurevisited.com` (`CNAME`)

**CI Pipeline:**
- GitHub Actions. `.github/workflows/ci.yml` runs on every push/PR: pnpm 10 + Node 22, then `pnpm typecheck`, `pnpm test`, `@hodoku/app build`, `@hodoku/website build`, `@hodoku/website test`
- `.github/workflows/pages.yml` deploys on push to `main` and manual `workflow_dispatch`
- Dependabot: npm (weekly, grouped minor+patch) and GitHub Actions (monthly) — `.github/dependabot.yml`

## Environment Configuration

**Required env vars / secrets:**
- `SITE_URL` - set in CI for the website build (writes `sitemap.xml`, `robots.txt`, `CNAME`)
- `SITE_PASSWORD` (GitHub Actions secret, optional) - enables the temporary password gate on manual deploy
- `CLOUDFLARE_API_TOKEN` (GitHub Actions secret) - Cloudflare Pages deploy API token
- `GOOGLE_PLAY_BILLING` - no secret in repo; billing is a browser Digital Goods API, configured in the Google Play / TWA console

**Secrets location:**
- GitHub Actions repository secrets (referenced in `.github/workflows/pages.yml`). No `.env` files present in the repo.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None. No server-side webhook or callback integrations.

## Notes

- The "AI Coach" / "Symbolic AI Coach" is **not** an external AI/LLM integration — it is deterministic local TypeScript in `packages/app/src/aiCoach.ts`, built on `@hodoku/core` (`packages/core/src/solver/*`). See `AGENTS.md` branding note.
- The Android App Links file (`.well-known/assetlinks.json`) is generated with a placeholder package name `com.revisitedlabs.hodoku` and two SHA-256 fingerprints (`packages/website/src/build.mjs` lines 676-697), enabling the Trusted Web Activity that hosts the Play Billing integration.

---

*Integration audit: 2026-11-03*
