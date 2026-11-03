---
last_mapped_commit: 3b3ec17d9ff5204ecb014376389f129395489040
last_mapped_at: 2026-11-03
---
<!-- refreshed: 2026-11-03 -->
# Codebase Structure

**Analysis Date:** 2026-11-03

## Directory Layout

```
C:\dev\hodoku_revisited\
├── .github\                     # CI workflows, PR template, CODEOWNERS, dependabot
├── .planning\codebase\          # GSD codebase map (this directory)
├── docs\                        # PORT-PLAN.md, LICENSE-AUDIT.md, design/, legacy captures
├── node_modules\                # pnpm workspace hoisted deps (gitignored)
├── packages\
│   ├── core\                    # engine — pure TypeScript, no DOM/Node
│   │   ├── src\
│   │   │   ├── generated\       # generated: defaultSteps.ts, solutionType.ts
│   │   │   ├── generator\       # sudokuGenerator.ts, levelGenerator.ts, random.ts
│   │   │   └── solver\          # 12 specialized solvers + stepFinder + sudokuSolver
│   │   └── test\                # Vitest golden/findall/formats/generator tests
│   ├── app\                     # PWA — React 19 + Vite 8
│   │   ├── public\              # icons, manifest, sw.js
│   │   ├── scripts\             # gen-bank.ts, merge-bank.mjs, icon generators
│   │   ├── src\
│   │   │   ├── bank\            # bank.json + bank.ts (puzzle bank)
│   │   │   ├── components\      # React UI components
│   │   │   ├── hooks\           # React hooks (useNewGame, useSolverPanel, …)
│   │   │   ├── monetization\    # AdBanner, consent-aware monetization
│   │   │   └── … (pure modules) # game.ts, solverApi.ts, worker.ts, protocol.ts, …
│   │   └── test\                # Vitest unit tests
│   └── website\                 # dependency-free static site generator
│       ├── scripts\             # gen-examples.ts
│       ├── src\                 # build.mjs + page content modules
│       └── test\                # node --test site output assertions
├── scripts\                     # fetch-reference.py, gen-tables.py
├── tools\golden\                # original Java golden reference + selector
├── package.json                 # workspace root (test/typecheck passthrough)
├── pnpm-workspace.yaml          # packages/* workspace glob
├── pnpm-lock.yaml
├── tsconfig.base.json           # shared strict TS config
└── AGENTS.md / README.md / CONTRIBUTING.md / SECURITY.md / LICENSE / NOTICE.md
```

## Directory Purposes

**packages/core:**
- Purpose: The engine — board model, solver, generator, text formats. The authoritative TypeScript port of HoDoKu 2.2.0.
- Contains: `sudoku2.ts`, `tables.ts`, `formats.ts`, `options.ts`, `solutionStep.ts`, `solutionType.ts`, `stepMarks.ts`, `als.ts`, `chain.ts`, `restrictedCommon.ts`, `singlesQueue.ts`, `sudokuSet.ts`, `templates.ts`, `solverOptions.ts`; `solver/`, `generator/`, `generated/` subdirectories.
- Key files: `src\index.ts` (public API), `src\solver\sudokuSolver.ts`, `src\solver\stepFinder.ts`, `src\sudoku2.ts`.

**packages/app:**
- Purpose: The PWA — the playable Sudoku UI and the worker bridge to the engine.
- Contains: React components (`components\`), hooks (`hooks\`), pure game/API modules, worker plumbing, puzzle bank, monetization, static assets.
- Key files: `src\App.tsx`, `src\main.tsx`, `src\game.ts`, `src\solverApi.ts`, `src\worker.ts`, `src\solverClient.ts`, `src\protocol.ts`, `src\storage.ts`, `src\aiCoach.ts`, `src\Board.tsx`.

**packages/website:**
- Purpose: Static site — home, technique guides, Learn pages, manual, about/privacy, plus the app copied into `/play/`.
- Contains: `build.mjs` (generator) and content modules `techniques.mjs`, `learn.mjs`, `manual.mjs`, `consent.mjs`, `gate.mjs`, `diagram.mjs`, `examples.json`.
- Key files: `src\build.mjs`, `src\techniques.mjs`, `src\manual.mjs`.

**docs:**
- Purpose: Project planning and audit documents.
- Contains: `PORT-PLAN.md` (status/roadmap), `LICENSE-AUDIT.md`, `FEATURE-COMPARISON.md`, `design/`, `hodoku_legacy_captures/`.

**scripts (root):**
- Purpose: Offline tooling for the port.
- Contains: `fetch-reference.py` (fetch original Java source), `gen-tables.py` (generate `core\src\generated\*`).

**tools/golden:**
- Purpose: Golden-test reference for solver parity.
- Contains: `Golden.java` (original Java golden generator), `select.py`, `README.md`.

**.github:**
- Purpose: CI/CD and contribution config.
- Contains: `workflows\ci.yml`, `workflows\pages.yml`, `pull_request_template.md`, `CODEOWNERS`, `dependabot.yml`, `ISSUE_TEMPLATE\`.

## Key File Locations

**Entry Points:**
- `C:\dev\hodoku_revisited\packages\core\src\index.ts`: Core public API barrel (main/types field of `@hodoku/core`).
- `C:\dev\hodoku_revisited\packages\app\src\main.tsx`: App React root + service-worker registration.
- `C:\dev\hodoku_revisited\packages\app\index.html`: Vite HTML entry.
- `C:\dev\hodoku_revisited\packages\website\src\build.mjs`: Website build entry.

**Configuration:**
- `C:\dev\hodoku_revisited\package.json`: Workspace root scripts (`test`, `typecheck` → `pnpm -r`).
- `C:\dev\hodoku_revisited\pnpm-workspace.yaml`: Workspace glob `packages/*`.
- `C:\dev\hodoku_revisited\tsconfig.base.json`: Shared strict TS settings (ES2022 target, ESNext module, `Bundler` resolution).
- `C:\dev\hodoku_revisited\packages\core\tsconfig.json`, `packages\app\tsconfig.json`: Per-package TS configs.
- `C:\dev\hodoku_revisited\packages\app\vite.config.ts`: Vite config (`base: './'`, React plugin, ES worker).
- `C:\dev\hodoku_revisited\packages\core\vitest.config.ts`, `packages\app\vitest.config.ts`: Vitest configs (core sets 600 s timeout for golden tests).
- `C:\dev\hodoku_revisited\packages\app\public\manifest.webmanifest`: PWA manifest.

**Core Logic:**
- `C:\dev\hodoku_revisited\packages\core\src\sudoku2.ts`: Board model.
- `C:\dev\hodoku_revisited\packages\core\src\solver\sudokuSolver.ts`: Solver orchestration and rating.
- `C:\dev\hodoku_revisited\packages\core\src\solver\stepFinder.ts`: Technique dispatch + shared caches.
- `C:\dev\hodoku_revisited\packages\core\src\solver\abstractSolver.ts`: Solver base class.
- `C:\dev\hodoku_revisited\packages\core\src\generator\levelGenerator.ts`: Level-targeted generation.
- `C:\dev\hodoku_revisited\packages\app\src\game.ts`: Pure game rules.
- `C:\dev\hodoku_revisited\packages\app\src\solverApi.ts`: Pure worker-facing API.
- `C:\dev\hodoku_revisited\packages\app\src\aiCoach.ts`: Symbolic AI coach.

**Testing:**
- `C:\dev\hodoku_revisited\packages\core\test\`: `golden.test.ts`, `findall.test.ts`, `formats.test.ts`, `generator.test.ts`, `sudoku2.test.ts`, `sudokuSet.test.ts`, `fixtures\`.
- `C:\dev\hodoku_revisited\packages\app\test\`: `game.test.ts`, `solverApi.test.ts`, `store.test.ts`, `ui.test.ts`, `commands.test.ts`, `urlParams.test.ts`, `boardImage.test.ts`, `extendedPrint.test.ts`, `useHotkeys.test.ts`.
- `C:\dev\hodoku_revisited\packages\website\test\build.test.mjs`: builds site, asserts on output HTML.

## Naming Conventions

**Files:**
- `camelCase.ts` for core/app source modules (`sudoku2.ts`, `solverApi.ts`, `useNewGame.ts`).
- `PascalCase.tsx` for React components (`App.tsx`, `TopBar.tsx`, `SolverPanel.tsx`).
- `*.mjs` for dependency-free website modules and bundled scripts (`build.mjs`, `gen-bank.mjs`, `merge-bank.mjs`).
- `*.test.ts` (Vitest) and `*.test.mjs` (Node test runner) for tests.

**Directories:**
- `camelCase` (`generator`, `components`, `hooks`, `monetization`, `bank`).
- Grouped by layer within `core\src`: `solver\`, `generator\`, `generated\`.

**Tests:**
- Co-located in a per-package `test\` directory (not beside source); name mirrors the module under test (`game.ts` → `game.test.ts`).

## Where to Add New Code

**New solver technique:**
- Primary code: add a solver class in `C:\dev\hodoku_revisited\packages\core\src\solver\` extending `AbstractSolver`, then register it in `SudokuStepFinder`'s `solvers` array (`stepFinder.ts`). Update the generated `defaultSteps.ts` via `scripts\gen-tables.py` (do not hand-edit).
- Tests: `C:\dev\hodoku_revisited\packages\core\test\` — extend `golden.test.ts` / `findall.test.ts`; never weaken golden expectations.

**New app UI component:**
- Implementation: `C:\dev\hodoku_revisited\packages\app\src\components\` (`PascalCase.tsx`).
- Shared state/hook: `C:\dev\hodoku_revisited\packages\app\src\hooks\` (`use*.ts`).
- Wire it into `App.tsx`; add pure logic to `game.ts` only if it has no React/DOM.

**New worker message kind:**
- Contract: extend `WorkerRequest`/`WorkerResponse` in `C:\dev\hodoku_revisited\packages\app\src\protocol.ts`.
- API: add a pure function in `solverApi.ts`.
- Dispatch: add a branch in `worker.ts`; expose a method on `SolverClient` (`solverClient.ts`).
- Tests: `C:\dev\hodoku_revisited\packages\app\test\solverApi.test.ts`.

**New website page:**
- Implementation: add a content module in `C:\dev\hodoku_revisited\packages\website\src\` (e.g. `*.mjs`) and register it in `build.mjs`.
- Tests: extend `C:\dev\hodoku_revisited\packages\website\test\build.test.mjs`.

**Utilities:**
- Shared engine helpers: `C:\dev\hodoku_revisited\packages\core\src\` (export from `index.ts`).
- Shared app helpers (pure, UI-agnostic): `C:\dev\hodoku_revisited\packages\app\src\` (e.g. `files.ts`, `urlParams.ts`, `ui.ts`).

## Special Directories

**packages/core/src/generated:**
- Purpose: Solver step/default tables generated from original HoDoKu source.
- Generated: Yes (by `scripts\gen-tables.py`).
- Committed: Yes (but do not edit — regenerate).

**packages/app/src/bank:**
- Purpose: Offline-generated puzzle bank (`bank.json`) grouped by level.
- Generated: Yes (`bank.json` by `scripts\merge-bank.mjs`; `gen-bank.mjs` bundled from `gen-bank.ts`).
- Committed: `bank.json` yes; `gen-bank.mjs` bundled artifact is gitignored.

**packages/app/dist, packages/website/dist, node_modules:**
- Purpose: Build outputs and installed dependencies.
- Generated: Yes.
- Committed: No (gitignored).

**packages/app/public:**
- Purpose: Static assets served verbatim — icons, `manifest.webmanifest`, `sw.js` (service worker), `og-image.png`.
- Generated: Icons partly generated (`scripts\make-icon.py`, `make-png-icons.mjs`); `sw.js` hand-authored.
- Committed: Yes.

**tools/golden:**
- Purpose: Reference implementation for parity testing (original Java-derived golden output).
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-11-03*
