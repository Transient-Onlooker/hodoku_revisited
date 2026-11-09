---
last_mapped_commit: 3b3ec17d9ff5204ecb014376389f129395489040
last_mapped_at: 2026-11-03
---
<!-- refreshed: 2026-11-03 -->
# Architecture

**Analysis Date:** 2026-11-03

## System Overview

Hodoku Revisited is a modern TypeScript port of **HoDoKu 2.2.0** (Bernhard Hobiger's Sudoku generator/solver/trainer, 2008–12). It is a pnpm workspace monorepo of three packages: a pure engine (`core`), a browser PWA (`app`), and a dependency-free static-site generator (`website`). The overarching design constraint is **solver parity**: `core` reproduces the original Java solver step-for-step, verified by golden tests.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        packages/website (static)                      │
│  `C:\dev\hodoku_revisited\packages\website\src\build.mjs`            │
│  build.mjs → techniques.mjs / learn.mjs / manual.mjs / consent.mjs   │
│  (copies the app's Vite output verbatim into /play/)                 │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ generated pages reference /play/
┌──────────────────────────────▼───────────────────────────────────────┐
│                         packages/app (PWA, React 19 + Vite 8)         │
│  `C:\dev\hodoku_revisited\packages\app\src\`                          │
│  App.tsx / components/ / hooks/  ←  game.ts (pure) / store.ts         │
│        │                                                            │
│        │ SolverClient (solverClient.ts)                              │
│        ▼                                                            │
│  worker.ts (Web Worker)  →  solverApi.ts (pure)  →  aiCoach.ts       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ imports @hodoku/core (workspace:*)
┌──────────────────────────────▼───────────────────────────────────────┐
│                      packages/core (pure TypeScript)                  │
│  `C:\dev\hodoku_revisited\packages\core\src\`                        │
│  Sudoku2 (board model) · SudokuSolver · SudokuStepFinder             │
│  AbstractSolver + 12 specialized solvers · generator/ · formats/      │
│  generated/ (defaultSteps.ts, solutionType.ts — generated)           │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Board model | Grid state: values, candidate bitmaps, singles queues, status | `C:\dev\hodoku_revisited\packages\core\src\sudoku2.ts` |
| Solver | Step-by-step solve, difficulty rating, scoring | `C:\dev\hodoku_revisited\packages\core\src\solver\sudokuSolver.ts` |
| Step finder | Delegates technique search/execution to specialized solvers, caches shared state | `C:\dev\hodoku_revisited\packages\core\src\solver\stepFinder.ts` |
| Generator | Creates and rates puzzles, level selection | `C:\dev\hodoku_revisited\packages\core\src\generator\` |
| Formats | Text formats (clipboard, library, values-only) | `C:\dev\hodoku_revisited\packages\core\src\formats.ts` |
| Game state | Pure game rules, undo/redo, candidates | `C:\dev\hodoku_revisited\packages\app\src\game.ts` |
| Worker bridge | Message routing between UI and worker | `C:\dev\hodoku_revisited\packages\app\src\worker.ts` |
| Solver client | Promise wrapper over the worker with cancel | `C:\dev\hodoku_revisited\packages\app\src\solverClient.ts` |
| Solver API | Pure functions over `@hodoku/core`, worker-facing | `C:\dev\hodoku_revisited\packages\app\src\solverApi.ts` |
| AI Coach | Socratic walkthrough + contradiction prover | `C:\dev\hodoku_revisited\packages\app\src\aiCoach.ts` |
| App shell | Owns game, settings, dialogs; wires hooks | `C:\dev\hodoku_revisited\packages\app\src\App.tsx` |
| Site generator | Builds static HTML pages from string literals | `C:\dev\hodoku_revisited\packages\website\src\build.mjs` |

## Pattern Overview

**Overall:** Layered monorepo with a strict **UI → worker → pure API → engine** call chain and a **generated static site** layered on top.

**Key Characteristics:**
- Three-package pnpm workspace (`C:\dev\hodoku_revisited\pnpm-workspace.yaml`), ESM throughout, TypeScript `strict`.
- `core` is pure TypeScript: no DOM, no Node APIs. It is the single source of truth for solving behavior.
- The solver is a **port, not a rewrite**: behavior must match HoDoKu 2.2.0 exactly, enforced by golden tests.
- The app isolates all solver work in a **Web Worker**, keeping the UI thread responsive during hard-puzzle generation/analysis.
- `game.ts` and `solverApi.ts` are pure and unit-tested; React/UI concerns are excluded.
- The website has **zero runtime dependencies** and emits no separate JS assets (scripts are inlined).

## Layers

**Engine (core):**
- Purpose: Board model, solving, generation, text formats. The authoritative port of HoDoKu.
- Location: `C:\dev\hodoku_revisited\packages\core\src\`
- Contains: `sudoku2.ts`, `solver/` (12 specialized solvers + `stepFinder.ts` + `sudokuSolver.ts`), `generator/`, `formats.ts`, `tables.ts`, `options.ts`, `solutionStep.ts`, `solutionType.ts`, `stepMarks.ts`, `generated/`.
- Depends on: Nothing external (pure TS; only dev deps `vitest`, `@types/node`).
- Used by: `app` (via `@hodoku/core`), `website` (via `@hodoku/core` for examples).

**Worker API (app):**
- Purpose: Pure functions that translate UI-shaped inputs (`values`, `cands`) into engine calls and return drawable results.
- Location: `C:\dev\hodoku_revisited\packages\app\src\solverApi.ts`, `aiCoach.ts`, `bank\bank.ts`
- Depends on: `@hodoku/core`, `protocol.ts` types, `techniqueInfo.ts`.
- Used by: `worker.ts` (and directly by Vitest tests — `test\solverApi.test.ts`).

**Worker bridge (app):**
- Purpose: Message handler that dispatches request kinds to the API and returns typed responses.
- Location: `C:\dev\hodoku_revisited\packages\app\src\worker.ts`, `solverClient.ts`, `protocol.ts`
- Depends on: `solverApi.ts`; `solverClient.ts` instantiates the worker via `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
- Used by: React hooks/components through `SolverClient`.

**Presentation (app):**
- Purpose: React UI — board, dialogs, side panel, hooks for game/timer/collections/printing/hotkeys.
- Location: `C:\dev\hodoku_revisited\packages\app\src\App.tsx`, `components\`, `hooks\`, `Board.tsx`
- Depends on: `game.ts` (pure), `store.ts`/`storage.ts` (localStorage), `solverClient.ts`.
- Used by: `main.tsx` entry point.

**Static site (website):**
- Purpose: Dependency-free build that emits every page from string literals and copies the app into `/play/`.
- Location: `C:\dev\hodoku_revisited\packages\website\src\build.mjs`, `techniques.mjs`, `learn.mjs`, `manual.mjs`, `consent.mjs`, `gate.mjs`, `diagram.mjs`
- Depends on: `@hodoku/core` (for solver-verified diagrams in `examples.json`); reads the app's `dist`.
- Used by: CI (`pnpm --filter @hodoku/website build`) and GitHub Pages deploy.

## Data Flow

### Primary Request Path (solving a step / hint)

1. UI asks for a hint: `components\SolverPanel.tsx` / `hooks\useSolverPanel.ts` calls `SolverClient.hint(values, cands, level, disabled)` (`C:\dev\hodoku_revisited\packages\app\src\solverClient.ts`).
2. `SolverClient` posts a `WorkerRequest` with an auto-increment `id` to the worker (`worker.ts`).
3. `worker.ts` routes `kind: 'hint'` to `solverApi.hint()` (`C:\dev\hodoku_revisited\packages\app\src\solverApi.ts`).
4. `hint()` rebuilds a `Sudoku2` from `values`/`cands` via `boardToSudoku`, runs `SudokuSolver.getHint()`, and converts the `SolutionStep` to a `HintResult` via `toHintResult` (marks, notation, coach stages).
5. The worker posts the `WorkerResponse` back; `SolverClient` resolves the pending promise; the component renders the marks on the board.

### Puzzle Generation Path

1. UI requests a new game (`hooks\useNewGame.ts`) → `SolverClient.generate(level)` / `fromBank(level, seen)` / `daily(date, level)`.
2. Worker routes to `solverApi.generate()` → `generatePuzzle(level)` in `core\generator\levelGenerator.ts`.
3. `generatePuzzle` loops `SudokuGenerator.generateSudoku()`, rates each candidate with `SudokuSolver.solve({ maxLevel, rejectTooLowScore })`, returns when level matches.
4. `solverApi.analyze()` re-rates the result to produce the final `PuzzleInfo` (puzzle string, solution, level, score, solve path).

### Solve Path / All-Steps Flow

1. `solverApi.path()` / `solverApi.allHints()` drive `SudokuSolver.solve()` or `SudokuStepFinder.findAll*()` directly.
2. `SudokuStepFinder` lazily computes shared caches (candidates, positions, templates, ALS, restricted commons) invalidated by an incrementing `stepNumber`.
3. Specialized solvers (`AbstractSolver` subclasses) answer `getStep(type)` / `doStep(step)` in the original HoDoKu search order.

**State Management:**
- App UI state lives in React hooks and persists to `localStorage` via `storage.ts` (keys: `hodoku-revisited:game`, `:settings`, `:time`). Stored shapes are a backward-compatibility contract — never rename keys/values without a migration.
- Engine state is mutable `Sudoku2` instances passed between solver and finder; caches are recomputed via `setSudokuDirty()`.

## Key Abstractions

**Sudoku2:**
- Purpose: The mutable grid — values, per-cell candidate bitmaps, singles queues (`nsQueue`, `hsQueue`), status, score, level.
- Examples: `C:\dev\hodoku_revisited\packages\core\src\sudoku2.ts`
- Pattern: Bitmask candidate representation (bit d = digit d), typed-array buffers (`Uint16Array`, `Int32Array`), `clone()`/`set()` for backtracking.

**AbstractSolver:**
- Purpose: Base class for the 12 specialized technique solvers; each implements `getStep(type)` and `doStep(step)`.
- Examples: `C:\dev\hodoku_revisited\packages\core\src\solver\abstractSolver.ts`, `simpleSolver.ts`, `fishSolver.ts`, `chainSolver.ts`, `alsSolver.ts`, `uniquenessSolver.ts`, `wingSolver.ts`, `coloringSolver.ts`, `singleDigitPatternSolver.ts`, `miscellaneousSolver.ts`, `tablingSolver.ts`, `templateSolver.ts`, `lastResortSolvers.ts`.
- Pattern: Strategy/delegation — `SudokuStepFinder` iterates `solvers` in order; first solver that finds a step wins.

**SudokuStepFinder:**
- Purpose: Facade over the solvers plus the shared, lazily-recomputed caches (candidates, positions, templates, ALS/RC lists).
- Examples: `C:\dev\hodoku_revisited\packages\core\src\solver\stepFinder.ts`
- Pattern: Dirty-flag caching keyed on `stepNumber`.

**SolutionStep / StepMarks:**
- Purpose: A found step and its drawable marks (place/elim/chains/colors).
- Examples: `C:\dev\hodoku_revisited\packages\core\src\solutionStep.ts`, `stepMarks.ts`

**GameState / Snapshot:**
- Purpose: Pure, UI-agnostic game state with undo/redo snapshots.
- Examples: `C:\dev\hodoku_revisited\packages\app\src\game.ts`

**WorkerRequest / WorkerResponse / PuzzleInfo:**
- Purpose: The typed message contract between UI and worker; keep shapes in sync across `solverClient.ts`, `worker.ts`, `solverApi.ts`.
- Examples: `C:\dev\hodoku_revisited\packages\app\src\protocol.ts`

## Entry Points

**Core package:**
- Location: `C:\dev\hodoku_revisited\packages\core\src\index.ts`
- Triggers: Imported by `app` and `website` as `@hodoku/core` (main field points at `src\index.ts`).
- Responsibilities: Re-exports the public API — `Sudoku2`, `SudokuSet`, `SudokuSolver`, `SudokuStepFinder`, `SudokuGenerator`, `generatePuzzle`, `formatSudoku`/`parseSudoku`, `tables`, `SolutionType` info, defaults.

**App entry:**
- Location: `C:\dev\hodoku_revisited\packages\app\src\main.tsx`
- Triggers: Browser load of `index.html`; Vite dev server (`vite`) or production build.
- Responsibilities: Renders `<App/>` in React `StrictMode`, registers the service worker (`public\sw.js`) in production.

**Website build:**
- Location: `C:\dev\hodoku_revisited\packages\website\src\build.mjs`
- Triggers: `node src/build.mjs` (via `pnpm --filter @hodoku/website build`), run in CI after the app build.
- Responsibilities: Emits all static pages, `sitemap.xml`/`robots.txt` (when `SITE_URL` set), copies `packages/app/dist` into `dist/play/`.

## Architectural Constraints

- **Threading:** The engine is single-threaded and synchronous (one long golden test runs ~80 s). The app offloads solver work to a single Web Worker (`worker.ts`); `SolverClient.cancel()` terminates the worker to abort long jobs (hard generation).
- **Global state:** Engine holds mutable `Sudoku2` per solver/finder instance; caches in `SudokuStepFinder` are instance-scoped and dirty-flagged. App state persists to `localStorage` (`storage.ts`).
- **Generated files (do not edit):** `packages\core\src\generated\defaultSteps.ts` and `solutionType.ts` are produced by `scripts\gen-tables.py`; `app\src\bank\bank.json` by `scripts\merge-bank.mjs`; `website\src\examples.json` by `scripts\gen-examples.ts`. Edit the sources.
- **Solver parity:** Never change solver output, step ordering, or scoring to make a test pass — a golden diff is a bug in the change.
- **Dependency discipline:** `website` is deliberately dependency-free; no new runtime deps without clear reason.
- **Deployment:** `main` deploys via `.github\workflows\pages.yml`; `main` is protected — all changes via PR with passing CI.

## Anti-Patterns

### Editing generated files

**What happens:** Editing `packages\core\src\generated\defaultSteps.ts`, `solutionType.ts`, `app\src\bank\bank.json`, or `website\src\examples.json` directly.
**Why it's wrong:** They are regenerated from sources (`scripts\gen-tables.py`, `app\scripts\gen-bank.ts`, `website\scripts\gen-examples.ts`) and the edits are lost on the next generation, while silently diverging from the original HoDoKu tables.
**Do this instead:** Edit the generator source and rerun the matching script (see `AGENTS.md` "Do not edit generated files").

### Putting UI concerns in game.ts or solverApi.ts

**What happens:** Adding React hooks, DOM access, or rendering logic into the pure layers.
**Why it's wrong:** `game.ts` and `solverApi.ts` are deliberately pure and unit-tested without a DOM or worker; contamination breaks `solverApi.test.ts`/`game.test.ts` and couples the engine to the browser.
**Do this instead:** Keep pure functions pure; put presentation in `components\`/`hooks\` and wire through `App.tsx`.

### Renaming localStorage keys/values

**What happens:** Renaming a stored key (e.g. `hodoku-revisited:game`) or a stored value (e.g. game mode `'practising'`) directly.
**Why it's wrong:** Settings, saved games, and the library live in users' browsers; a rename resets their data.
**Do this instead:** Change the display label only, or add a migration (`storage.ts` documents the contract).

## Error Handling

**Strategy:** Typed error responses across the worker boundary; graceful degradation in the browser.

**Patterns:**
- `worker.ts` wraps every dispatch in try/catch and returns `{ id, kind: 'error', message }` on throw (`C:\dev\hodoku_revisited\packages\app\src\worker.ts`).
- `SolverClient` converts `kind: 'error'` responses into thrown `Error`s; `CancelledError` signals an aborted call (`isCancelled`).
- `solverApi.analyze()` throws specific messages for invalid/ambiguous/unsolvable puzzles ("needs at least 17 givens", "no solution", "more than one solution").
- `storage.ts` swallows `localStorage` failures (private mode, quota) so persistence is best-effort.
- `SudokuStepFinder.doStep()` throws on an unrecognized step type (`Invalid solution step in doStep()`).

## Cross-Cutting Concerns

**Logging:** No structured logger; the app relies on error propagation to the UI. The website has no runtime logging.
**Validation:** Input puzzles are validated in `solverApi.analyze()` (given count, uniqueness via `SudokuGenerator.getNumberOfSolutions`) and in `Sudoku2.setSudoku` (rejects non-81-cell input).
**Authentication:** None — a fully client-side PWA. No accounts, no backend; persistence is `localStorage` only.
**Localization:** Not implemented; all UI text is plain English in American spelling (a website test fails on British spellings).
**Monetization:** AdSense loads only after consent (`consent.mjs` injects the loader on `/play/` and guide pages; ad slots are excluded from the game UI).

---

*Architecture analysis: 2026-11-03*
