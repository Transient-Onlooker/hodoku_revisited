---
last_mapped_commit: 3b3ec17d9ff5204ecb014376389f129395489040
last_mapped_at: 2026-11-03
---
# Technology Stack

**Analysis Date:** 2026-11-03

## Languages

**Primary:**
- TypeScript ~5.6.3 - Entire codebase (`packages/core`, `packages/app`); compiled by `tsc`, bundled by Vite/esbuild
- JavaScript (ESM `.mjs`) - `packages/website` static site generator (deliberately TypeScript-free build scripts: `packages/website/src/build.mjs`, `consent.mjs`, `gate.mjs`)

**Secondary:**
- Python 3 - Source-generation tooling only: `scripts/gen-tables.py`, `scripts/fetch-reference.py`, `tools/golden/select.py`
- Java - Reference tooling only (not compiled in CI): `tools/golden/Golden.java`, fetched original HoDoKu source via `scripts/fetch-reference.py`

## Runtime

**Environment:**
- Node.js >= 20 (declared in `package.json` `engines`); CI and site build use Node 22 (`.github/workflows/ci.yml`, `.github/workflows/pages.yml`)

**Package Manager:**
- pnpm 10 (CI pins `pnpm/action-setup@v6` `version: 10`)
- Workspace: `pnpm-workspace.yaml` (`packages/*`)
- Lockfile: `pnpm-lock.yaml` present, `lockfileVersion: '9.0'`, `autoInstallPeers: true`

## Frameworks

**Core:**
- React ^19.3.1 - `packages/app` UI (`packages/app/src/App.tsx`, `src/components/*`)
- React DOM ^19.3.1
- Vite ^8.3.5 - app dev server and bundler (`packages/app/vite.config.ts`, `base: './'`, `worker.format: 'es'`, `build.target: 'es2022'`)
- `@vitejs/plugin-react` ^6.1.2

**Testing:**
- Vitest ^5.0.5 - `packages/core` and `packages/app` (`.test.ts` under each `test/` dir)
- Node built-in test runner (`node --test`) - `packages/website` (`packages/website/test/build.test.mjs`)

**Build/Dev:**
- esbuild 0.28.2 - bundles generator scripts (`packages/app/scripts/gen-bank.ts`, `packages/website/scripts/gen-examples.ts`) and root dev tooling
- TypeScript ~5.6.3 - type-checking across packages (`pnpm typecheck` -> `tsc --noEmit` per package; `node --check` for website `.mjs`)

## Key Dependencies

**Critical:**
- `@hodoku/core` (workspace:*) - the solver/generator engine consumed by `packages/app` and `packages/website`; pure TypeScript, no DOM/Node APIs (`packages/core/package.json`)

**Infrastructure (app):**
- `@fontsource/ibm-plex-mono` ^5.3.0, `@fontsource/ibm-plex-sans` ^5.3.0, `@fontsource/newsreader` ^5.3.0 - self-hosted fonts (no Google Fonts runtime dependency); WOFF2 files copied to `packages/website/dist/fonts/` by `packages/website/src/build.mjs`

**Dev-only:**
- `@types/node` ^22.9.0 (`packages/core`)
- `@types/react` ^19.3.0, `@types/react-dom` ^19.3.0 (`packages/app`)

## Configuration

**Environment:**
- No committed `.env` files and no `.nvmrc`/`.node-version`/`.npmrc` detected. Configuration flows through CI environment variables:
  - `SITE_URL` (e.g. `https://hodokurevisited.com/`) - enables `sitemap.xml`, `robots.txt`, `CNAME` output in `packages/website/src/build.mjs`
  - `SITE_PASSWORD` - optional pre-release password gate (`packages/website/src/gate.mjs`)

**TypeScript:**
- Shared compiler options in `C:\dev\hodoku_revisited\tsconfig.base.json`: `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`, `esModuleInterop`, `isolatedModules`, `skipLibCheck`
- `packages/core/tsconfig.json` adds `types: ["node"]`
- `packages/app/tsconfig.json` adds `lib: [..., "DOM", "DOM.Iterable", "WebWorker"]`, `jsx: react-jsx`, `types: ["vite/client"]`, `noEmit: true`

**Build:**
- `packages/app/vite.config.ts` (`base: './'`, React plugin, ES worker format, `es2022` target)
- `packages/core/vitest.config.ts` - `testTimeout: 600_000` (golden tests are one ~80s synchronous test)
- `packages/app/vitest.config.ts` - `testTimeout: 120_000`, `hookTimeout: 120_000`
- Website has no config file; build is a plain Node script (`packages/website/src/build.mjs`)

## Platform Requirements

**Development:**
- Node >= 20 (CI uses 22), pnpm 10
- `pnpm install` may print `ERR_PNPM_IGNORED_BUILDS` for `esbuild` (expected)

**Production:**
- Static site + PWA deployed to Cloudflare Pages at https://hodokurevisited.com/ via `cloudflare/wrangler-action@v3` (`pages deploy packages/website/dist --project-name=hodoku-revisited`), custom domain `hodokurevisited.com` (`CNAME`)
- `packages/app` builds to `packages/app/dist`; copied verbatim to `/play/` of the site build

---

*Stack analysis: 2026-11-03*
