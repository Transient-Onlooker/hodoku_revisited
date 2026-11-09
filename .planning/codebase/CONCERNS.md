---
last_mapped_commit: 3b3ec17d9ff5204ecb014376389f129395489040
last_mapped_at: 2026-11-03
---
# Codebase Concerns

**Analysis Date:** 2026-11-03

## Tech Debt

**Type-safety hole in `noUncheckedIndexedAccess`:**
- Issue: `C:\dev\hodoku_revisited\tsconfig.base.json` sets `"noUncheckedIndexedAccess": false`. Array/record index access returns `T` instead of `T | undefined`, so out-of-bounds and missing-key reads do not surface at compile time. The core solver relies on dense 81-cell arrays and bitmask lookups, so a subtle indexing bug there would be silent.
- Files: `C:\dev\hodoku_revisited\tsconfig.base.json` (line 8)
- Impact: Undefined values pass type checks and only fail at runtime, or worse produce wrong solver results that golden tests may not cover.
- Fix approach: Flip to `true` and fix the fallout (add explicit `?? 0` / `?? []` defaults). Do it package by package, not repo-wide at once.

**Unwired "Revisited Labs" monetization module:**
- Issue: `C:\dev\hodoku_revisited\packages\app\src\monetization\` contains a generic entitlement/purchase engine (`monetization.ts`, `AdBanner.tsx`, `useMonetization.ts`) that is not imported by `App.tsx` or any other component. It is dead code in the app. Ad revenue actually comes from the website's consent-gated AdSense, not from this module.
- Files: `C:\dev\hodoku_revisited\packages\app\src\monetization\monetization.ts`, `AdBanner.tsx`, `useMonetization.ts`
- Impact: Confusing duplicate ad/purchase code paths, two different `localStorage` entitlement keys, and a maintenance surface nobody exercises. `AdBanner`'s `slotId` prop is accepted but never used.
- Fix approach: Delete the module or wire `AdBanner`/`useMonetization` into the app deliberately. If kept, add tests and align the entitlement key with the website consent keys.

**`any` in the monetization module:**
- Issue: `window as any` and `catch (err: any)` throughout. `getDigitalGoodsService` is untyped.
- Files: `C:\dev\hodoku_revisited\packages\app\src\monetization\monetization.ts` (lines 163, 204, 213, 245, 284, 315)
- Impact: The Digital Goods / PaymentRequest API surface is not type-checked; API drift breaks silently at runtime.
- Fix approach: Add a minimal `Window` augmentation / `DigitalGoodsService` typing (the interface already exists in the same file) and drop the `any` catches for `unknown`.

**Large, dense source files:**
- Issue: Several files exceed 600 lines and mix many concerns.
- Files: `C:\dev\hodoku_revisited\packages\core\src\solver\tablingSolver.ts` (1325 lines — flagged in `docs/PORT-PLAN.md` as the "largest and riskiest"), `C:\dev\hodoku_revisited\packages\core\src\solver\fishSolver.ts` (927), `C:\dev\hodoku_revisited\packages\app\src\aiCoach.ts` (923), `C:\dev\hodoku_revisited\packages\core\src\solver\uniquenessSolver.ts` (724), `C:\dev\hodoku_revisited\packages\website\src\build.mjs` (674).
- Impact: High cognitive load, hard to review safely; `tablingSolver` is where a solver-regression is most likely.
- Fix approach: Extract helpers only where it does not risk changing step ordering (the solver must stay byte-for-byte identical to HoDoKu — refactor with care, keep golden tests green).

**No lint/format tooling:**
- Issue: Per `AGENTS.md`, "No Prettier or ESLint is configured". Style is enforced only by convention and an American-spelling website test.
- Files: no `eslint.config.*`, no `.prettierrc*` present.
- Impact: Inconsistent formatting and no static analysis net; typos that are valid TS (e.g. an unused variable, a missing `await`) slip through.
- Fix approach: Adopt a minimal ESLint + Prettier config (or Biome), applied to `packages/core` first; do not reformat solver code in a way that complicates golden diffs.

**Intentional `eslint-disable` on a mount effect:**
- Issue: `C:\dev\hodoku_revisited\packages\app\src\hooks\useNewGame.ts` (line 118) suppresses `react-hooks/exhaustive-deps` on the first-start effect, which reads `settingsRef.current` and `window.location` once.
- Impact: The deps array `[]` is correct for "run once on mount", but the suppression hides future drift if a ref dependency is added.
- Fix approach: Keep the suppression but document the invariant, or refactor to read params outside the effect so the linter is satisfied naturally.

**Unported solver options throw instead of answering:**
- Issue: Features from original HoDoKu that are not yet ported raise `Error` rather than returning a degraded result.
- Files: `C:\dev\hodoku_revisited\packages\core\src\solver\fishSolver.ts` (lines 281, 742), `C:\dev\hodoku_revisited\packages\core\src\solver\singleDigitPatternSolver.ts` (line 117) for `allowDualsAndSiamese`; `C:\dev\hodoku_revisited\packages\core\src\solver\tablingSolver.ts` (line 171) for `allowAlsInTablingChains`.
- Impact: Any caller enabling those options crashes. Safe default, but the option surface is incomplete.
- Fix approach: Track these as backlog items (already in `docs/PORT-PLAN.md`); until then keep the throws so no wrong answers are produced.

**Not-ported export format:**
- Issue: `PM_GRID_WITH_STEP` / step-typed library export is not implemented (documented in `docs/PORT-PLAN.md` Known gaps).
- Impact: Some copy/export fidelity vs. the original is missing.
- Fix approach: Port when a user need materializes; low priority.

## Known Bugs

**Reproduced original Kraken stale-array bug:**
- Symptoms: The port intentionally reads stale array entries during Kraken fish search (a fish with more cover units than base units, bounds `numberOfCoverUnits - baseLevel + coverLevel`), exactly matching HoDoKu's bug, so "find all steps" results depend on what ran before.
- Files: `C:\dev\hodoku_revisited\packages\core\src\solver\fishSolver.ts`; harness replay in `C:\dev\hodoku_revisited\packages\core\test\findall.test.ts`.
- Trigger: Running the Kraken search after other searches in a different order than the recorded harness.
- Workaround: The test replays the original harness sequence to get identical results. This is a fidelity requirement, not a defect to fix — document it clearly if the harness sequence changes.

**Non-total step comparators:**
- Symptoms: Equal-rank step ordering for ALS, forcing chains/nets and Kraken fish differs from the original because HoDoKu's comparators return `1` in both directions (not a consistent ordering).
- Files: `C:\dev\hodoku_revisited\packages\core\src\solver\tablingSolver.ts` (`compareTablingSteps`), ALS and fish comparators.
- Trigger: Any comparison of ordered step lists.
- Workaround: `findall.test.ts` compares those lists as sets. Do not "fix" the comparators to be total orderings — that would change output vs. the reference.

**Weak password gate (not real access control):**
- Symptoms: `C:\dev\hodoku_revisited\packages\website\src\gate.mjs` embeds a salted SHA-256 hash of `SITE_PASSWORD` in the page and hides the DOM until the user enters it. The files remain fetchable by URL; only casual visitors and crawlers are kept out (pages get `noindex`).
- Files: `C:\dev\hodoku_revisited\packages\website\src\gate.mjs`
- Trigger: Enabling the gate in `pages.yml` and guessing/leaking the password; or fetching `dist/*.html` directly.
- Workaround: The gate is off in production (`pages.yml` `gate` default false). For real protection use Cloudflare Access. Treat any gated deployment as public.

## Security Considerations

**Client-side ad-free entitlement is forgeable:**
- Risk: The "Remove ads" lifetime purchase is stored as a plain `localStorage` flag (`revisited_ad_free_v1 = '1'`) and there is no server-side receipt verification. Any user can run `localStorage.setItem('revisited_ad_free_v1','1')` to get ad-free without paying.
- Files: `C:\dev\hodoku_revisited\packages\app\src\monetization\monetization.ts` (lines 16, 96, 107-119, 278-279)
- Current mitigation: None. The `listPurchases`/`getDetails` Digital Goods calls only run in a Google Play TWA context, but the persisted flag is trusted unconditionally on next load.
- Recommendations: Treat the client flag as a cache, not the source of truth; verify against `listPurchases()` (or a server) on every session, or accept the forgeability and price accordingly. Do not rely on this for anything with real cost.

**Hardcoded payment amount diverges from localized price:**
- Risk: `purchaseRemoveAds` builds `PaymentRequest` with hardcoded `currency: 'USD', value: '2.99'` even though `init()` fetches a localized price and displays it in the UI.
- Files: `C:\dev\hodoku_revisited\packages\app\src\monetization\monetization.ts` (lines 259-267 vs. 186-201)
- Current mitigation: None.
- Recommendations: Use the fetched localized `price.currency`/`price.value` in the PaymentRequest, or drop localization.

**`innerHTML` template injection in consent banner:**
- Risk: `C:\dev\hodoku_revisited\packages\website\src\consent.mjs` (line 78) and `gate.mjs` (line 26) assign markup strings via `innerHTML`. The interpolated value `root` is derived from path depth (`.split('/')`), and the copy is static, so no user-controlled content currently reaches it.
- Files: `C:\dev\hodoku_revisited\packages\website\src\consent.mjs` (line 78), `C:\dev\hodoku_revisited\packages\website\src\gate.mjs` (line 26)
- Current mitigation: Static strings only.
- Recommendations: Keep all interpolated values static/whitelisted; if any dynamic copy is ever added, switch to `textContent`/`createElement`.

**SVG injected via `dangerouslySetInnerHTML` (safe by construction):**
- Risk: `C:\dev\hodoku_revisited\packages\app\src\components\BookPrint.tsx` (line 28) renders `boardSvg(...)` through `dangerouslySetInnerHTML`.
- Files: `C:\dev\hodoku_revisited\packages\app\src\components\BookPrint.tsx`, `C:\dev\hodoku_revisited\packages\app\src\boardImage.ts` (line 57)
- Current mitigation: `boardSvg` emits only numeric digits and fixed constants (comment at line 54-55: "Only digits and numbers are written, so nothing needs escaping"), so no injection vector. `cellColors`/`candColors` come from `palette` (numeric indices), not free-form HTML.
- Recommendations: Preserve that invariant; if a future change lets `palette` colors or a name flow into the SVG string, HTML-escape it.

**Third-party script loading after consent:**
- Risk: `consent.mjs` injects `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` only after Accept (line 59-65, 87). It also defines a global `gtag`/`dataLayer` shim for Consent Mode v2.
- Files: `C:\dev\hodoku_revisited\packages\website\src\consent.mjs`
- Current mitigation: Consent defaults to `denied` for EEA/UK/CH (lines 53-57), `ads_data_redaction: true`, and no AdSense is requested before consent (asserted by `build.test.mjs` lines 34-58).
- Recommendations: Keep the no-static-AdSense test; the hand-rolled banner is not a certified CMP (noted in `docs/PORT-PLAN.md`), so a certified CMP may still be required for full TCF v2.2 compliance.

**No `.env` / credential files present:**
- Note: No `.env`, credential, key, or certificate files were detected in the repo (excluding `node_modules`). Secrets are supplied via GitHub Actions (`SITE_PASSWORD`, `CLOUDFLARE_API_TOKEN` in `pages.yml`) and never committed.

## Performance Bottlenecks

**Slow generator (Level 2):**
- Problem: Generating a Level 2 puzzle takes about 2.7 s per puzzle (documented in `docs/PORT-PLAN.md`).
- Files: `C:\dev\hodoku_revisited\packages\core\src\generator\sudokuGenerator.ts`
- Cause: Clue-removal + re-rating loop.
- Improvement path: Already mitigated by a precomputed bank (`C:\dev\hodoku_revisited\packages\app\src\bank\bank.json`, 1,300 puzzles) and a Web Worker. The generator is only the fallback.

**`train()` scans up to 500 puzzles:**
- Problem: `train()` (maxTries 500) fully `analyze()`s each candidate bank puzzle to find one using a requested technique.
- Files: `C:\dev\hodoku_revisited\packages\app\src\solverApi.ts` (lines 160-180)
- Cause: A full solve + path computation per candidate.
- Improvement path: Runs in the worker so the UI stays responsive; consider caching each puzzle's solve path or pre-indexing technique usage per bank puzzle.

**"Find all steps" runs every technique:**
- Problem: `allHints()` invokes ~20 "find all" searches (including forcing nets) on a clone per call; the All steps / trainer panel calls it.
- Files: `C:\dev\hodoku_revisited\packages\app\src\solverApi.ts` (lines 304-359)
- Cause: Expensive tabling/fish/ALS searches.
- Improvement path: Runs in the worker; avoid re-triggering on every keystroke (check the caller debounces), and consider level-based short-circuiting already present (`run(minLevel, ...)`).

**Extended print builds up to 99 puzzles per section:**
- Problem: `book()` loops sections x count (each up to 99), potentially analyzing many puzzles.
- Files: `C:\dev\hodoku_revisited\packages\app\src\solverApi.ts` (lines 195-213)
- Cause: Nested generation/analysis per printed puzzle.
- Improvement path: Batch in the worker and stream progress; a long book already blocks the worker until complete.

**Slow golden test suite (~80 s single test):**
- Problem: `golden.test.ts` compares 34,672 solver steps in one synchronous test (~80 s); the config raises the timeout to 10 minutes.
- Files: `C:\dev\hodoku_revisited\packages\core\vitest.config.ts` (line 5), `C:\dev\hodoku_revisited\packages\core\test\golden.test.ts`
- Cause: One long lockstep comparison by design.
- Improvement path: Leave as-is (per `AGENTS.md`, do not shorten the timeout); consider splitting the corpus to parallelize without changing the comparison.

## Fragile Areas

**`localStorage` shapes are a data contract with no migration:**
- Files: `C:\dev\hodoku_revisited\packages\app\src\storage.ts`, `C:\dev\hodoku_revisited\packages\app\src\store.ts`
- Why fragile: Renaming a key or a stored value (e.g. the game mode `'practising'`) resets users' data. `load`/`loadJson` swallow `JSON.parse` errors and return `null`/fallback, so corrupt or schema-drifted data is silently dropped.
- Safe modification: Change labels, not values; add a `version` field and a migration path before renaming keys.
- Test coverage: `store.test.ts` covers cap/remove/load-fallback; no migration test.

**Worker message shapes must stay in sync across three files:**
- Files: `C:\dev\hodoku_revisited\packages\app\src\protocol.ts` (defines `WorkerRequest`/`WorkerResponse`), `C:\dev\hodoku_revisited\packages\app\src\worker.ts` (dispatch), `C:\dev\hodoku_revisited\packages\app\src\solverClient.ts` (client), `C:\dev\hodoku_revisited\packages\app\src\solverApi.ts` (pure handlers).
- Why fragile: A mismatch surfaces only at runtime as `'unexpected response'` or a dropped message. `worker.ts` has no exhaustive-check on `req.kind`.
- Safe modification: Add a type-level exhaustiveness check (`switch`/`never`) for `WorkerRequest.kind`, and keep `protocol.ts` as the single source of truth.
- Test coverage: `solverApi.test.ts` covers the pure handlers; no integration test between worker and client.

**Module-level `monetization` singleton:**
- Files: `C:\dev\hodoku_revisited\packages\app\src\monetization\monetization.ts` (line 325)
- Why fragile: Global mutable state with a shared `initPromise`; test isolation requires the `_resetForTesting()` hook.
- Safe modification: Inject the manager instead of importing the singleton where possible.
- Test coverage: None.

**Generated files edited by hand:**
- Files: `C:\dev\hodoku_revisited\packages\core\src\generated\*` (`defaultSteps.ts`, `solutionType.ts`), `C:\dev\hodoku_revisited\packages\app\src\bank\bank.json`, `C:\dev\hodoku_revisited\packages\website\src\examples.json`.
- Why fragile: They are regenerated by `scripts/gen-tables.py`, `gen-bank.ts`/`merge-bank.mjs`, and `gen-examples.ts`. Hand edits are overwritten.
- Safe modification: Edit the sources, not the outputs (per `AGENTS.md`). The bundler output `.mjs` files are gitignored.
- Test coverage: Golden tests and website link tests depend on these being correct.

## Scaling Limits

**Puzzle bank size:**
- Current capacity: 1,300 puzzles total (~260 per level across Easy–Extreme) in `C:\dev\hodoku_revisited\packages\app\src\bank\bank.json` (109 KB).
- Limit: A level is exhausted after ~260 distinct plays; the code then re-picks from all of them (documented in `useNewGame.ts`).
- Scaling path: Regenerate a larger bank with `gen-bank.ts`; the `seen` bookkeeping in `settings.seen` scales with bank size (stored in `localStorage`).

**`localStorage` quotas and caps:**
- Current capacity: `LIBRARY_CAP = 200`, `HISTORY_CAP = 100`, `SAVEPOINTS_CAP = 20` in `C:\dev\hodoku_revisited\packages\app\src\store.ts`. Save points store full `values`/`cands`/`solution`/color arrays uncompressed.
- Limit: Browser `localStorage` is typically ~5 MB; large libraries/history plus several save points can exhaust it. On quota, `save`/`saveJson` swallow the error and silently lose data.
- Scaling path: For the planned cloud-sync backend, move persistence server-side; until then, consider capping save-point size or compressing candidate arrays.

**Solver worker memory:**
- Current capacity: Single `Worker` created lazily in `C:\dev\hodoku_revisited\packages\app\src\solverClient.ts` (line 26); `cancel()` terminates and discards it.
- Limit: A single long job (forcing nets / extended print) blocks the one worker; no job queue or prioritization.
- Scaling path: Fine for a single-user PWA; if jobs start to contend, add a small queue or a second worker.

## Dependencies at Risk

**Pinned-but-old toolchain:**
- Risk: `typescript` is pinned `~5.6.3` across the workspace while `vite` is `^8.3.5` and `vitest` `^5.0.5`; `@types/node` is `^22.9.0` but `package.json` engines allow Node `>=20` (CI uses Node 22).
- Impact: TypeScript version drift can mask or block new Vite/Vitest releases.
- Migration plan: Dependabot already opens grouped bump PRs; land TypeScript and `@types/node` bumps deliberately and re-run `pnpm typecheck` + `pnpm test`.

**Vitest 5 synchronous-test timeout behavior:**
- Risk: Vitest 5 enforces its default 5 s on synchronous tests; the golden test needs 10 min.
- Impact: A dependency bump that resets the timeout breaks CI.
- Migration plan: The config in `C:\dev\hodoku_revisited\packages\core\vitest.config.ts` already sets `testTimeout`/`hookTimeout` to 600,000 ms. Keep it; do not shorten (per `AGENTS.md`).

**esbuild ignored-build warning:**
- Risk: `pnpm install` prints `ERR_PNPM_IGNORED_BUILDS` for `esbuild` (`0.28.2`, pinned).
- Impact: Cosmetic; esbuild still works. Documented as expected.
- Migration plan: None needed; leave the note.

## Missing Critical Features

**No cloud sync / accounts:**
- Problem: Current board, pencil marks, timer, library, history, and save points live only in one browser's `localStorage`. There is no cross-device sync or accounts.
- Blocks: The "Supporter & Cloud Sync Backend" backlog item in `docs/PORT-PLAN.md` (lines 248-254); portability between phone and desktop.
- Note: This is planned, not a defect. Until it lands, data is per-device and lost on browser clear.

**No i18n:**
- Problem: UI text is hardcoded American English (`packages/app/src` and `packages/website/src` string literals). No locale layer exists.
- Blocks: Multi-lingual support (backlog). A single extra language was deliberately deferred.
- Note: An American-spelling website test fails if British spellings appear.

## Test Coverage Gaps

**Untested monetization/entitlement module:**
- What's not tested: `MonetizationManager` purchase, entitlement persistence, `PaymentRequest` flow, `restorePurchases`, error paths.
- Files: `C:\dev\hodoku_revisited\packages\app\src\monetization\monetization.ts` (no `monetization.test.ts`).
- Risk: Forgeable entitlement and payment-amount bugs ship unnoticed.
- Priority: High (given the security concern above).

**`aiCoach.ts` has no direct tests:**
- What's not tested: The 923-line Socratic walkthrough and contradiction prover are only exercised indirectly through `solverApi.test.ts` hint results, not the full `coach` stage generation or the `prove` contradiction pruning.
- Files: `C:\dev\hodoku_revisited\packages\app\src\aiCoach.ts`
- Risk: Stage marks/narration regressions in an end-user-facing feature.
- Priority: Medium.

**Worker/client integration untested:**
- What's not tested: `worker.ts` dispatch and `solverClient.ts` cancellation/error recovery across a real `Worker`.
- Files: `C:\dev\hodoku_revisited\packages\app\src\worker.ts`, `C:\dev\hodoku_revisited\packages\app\src\solverClient.ts`
- Risk: Message-shape drift (see Fragile Areas) breaks hints/generation at runtime.
- Priority: Medium.

**Service worker and consent runtime untested:**
- What's not tested: `sw.js` offline/cache behavior; `consent.mjs` banner interaction is only asserted statically in `build.test.mjs` (no browser run committed).
- Files: `C:\dev\hodoku_revisited\packages\app\public\sw.js`, `C:\dev\hodoku_revisited\packages\website\src\consent.mjs`
- Risk: Offline install or consent-gating regressions ship unnoticed.
- Priority: Medium.

**No E2E/Playwright test committed:**
- What's not tested: Full browser flows (hint, import, offline reload, install) that `docs/PORT-PLAN.md` says were covered by a Playwright run are not present as a committed test; no Playwright dependency exists.
- Files: no Playwright config or spec in `packages/**`.
- Risk: UI regressions not caught in CI.
- Priority: Low (manual browser testing currently covers it).

**Solver internals beyond golden corpus:**
- What's not tested: Death Blossom, Simple Colors Wrap, Franken X-Wing, and the Naked/Locked subset step cache are not exercised by the golden corpus (noted in `docs/PORT-PLAN.md` Known gaps).
- Files: `C:\dev\hodoku_revisited\packages\core\src\solver\*`
- Risk: A regression in those techniques could pass CI.
- Priority: Low (verified where possible; corpus is a HoDoKu limitation).

---

*Concerns audit: 2026-11-03*
