---
last_mapped_commit: 3b3ec17d9ff5204ecb014376389f129395489040
last_mapped_at: 2026-11-03
---
# Coding Conventions

**Analysis Date:** 2026-11-03

## Language & Module System

- **TypeScript**, `strict: true` (set in `C:/dev/hodoku_revisited/tsconfig.base.json`).
- **ESM throughout** — every package has `"type": "module"` in its `package.json`.
- Core (`@hodoku/core`) is pure TypeScript with **no DOM and no Node APIs**; the app (`@hodoku/app`) adds React 19; the website (`@hodoku/website`) is plain `.mjs`, deliberately dependency-free.
- Core imports use an **explicit `.js` extension** even for `.ts` sources (Bundler resolution): `import { Sudoku2 } from './sudoku2.js'`. App imports omit the extension (`import { analyze } from '../src/solverApi'`).

## Naming Patterns

**Files:**
- camelCase for modules: `sudoku2.ts`, `solverApi.ts`, `aiCoach.ts`, `levelGenerator.ts`.
- PascalCase for React components: `DigitPad.tsx`, `AllSteps.tsx`, `SettingsSheet.tsx`.
- `useXxx.ts` for hooks: `useHotkeys.ts`, `useTimer.ts`, `useCollections.ts`.
- `.mjs` for website source: `build.mjs`, `techniques.mjs`, `consent.mjs`.

**Functions:** camelCase, verbs first — `validCands`, `newGame`, `loadJson`, `isNotesToggleShortcut`, `paintCell`, `removeById`.

**Variables:** camelCase. Boolean flags read as predicates — `isGiven`, `isSolved`, `hasProgress`, `canBooklet`, `solutionSet`.

**Constants:** SCREAMING_SNAKE_CASE — `ALL_UNITS`, `MAX_MASK`, `DEFAULT_SETTINGS`, `LIBRARY_KEY`, `HINT_LEVEL_NAMES`, `ALL_CANDS`.

**Types / interfaces:** PascalCase — `GameState`, `SudokuStatus`, `WorkerRequest`, `HintResult`, `Store`, `CommandContext`. Discriminated unions use a shared discriminant field, commonly `kind` (`WorkerRequest`, `WorkerResponse` in `C:/dev/hodoku_revisited/packages/app/src/protocol.ts`).

**Generics:** single uppercase letter — `loadJson<T>`, `addCapped<T extends { at: number }>`.

## Code Style

**Formatting** (no Prettier, no ESLint, no Biome, no `.editorconfig` — match surrounding code):
- **2-space indent**.
- **Single quotes** for strings.
- **Semicolons** everywhere.
- 100-ish column lines; long import lists are wrapped one symbol per line (see `C:/dev/hodoku_revisited/packages/app/src/solverApi.ts`).

**Type annotations:**
- Explicit return types on functions: `export function newGame(info: PuzzleInfo): GameState`.
- Explicit parameter types always; `readonly` used on array/object params that must not mutate — `values: readonly number[]`, `cells: readonly number[]`.
- Type-only imports use `import type { ... }` or the inline `type` modifier: `import type { PathEntry, PuzzleInfo } from './protocol'`.

## Import Organization

**Order:**
1. Node built-ins (`node:fs`, `node:zlib`) — test/website files only.
2. External packages (`react`, `@hodoku/core`, `vitest`, `@vitejs/plugin-react`).
3. Local relative imports (`../src/game`, `./protocol`, `./tables.js`).

No path aliases — all relative paths. The app imports the engine through the workspace package name `@hodoku/core` (see `C:/dev/hodoku_revisited/packages/app/package.json`).

**Named exports preferred.** The core package re-exports everything through a barrel, `C:/dev/hodoku_revisited/packages/core/src/index.ts`, including `export * as tables from './tables.js'`. `export default` is used only for `defineConfig` in the two `vitest.config.ts` files.

## File Headers

Every source file carries a copyright/license header:

- Core full GPL header (see `C:/dev/hodoku_revisited/packages/core/src/formats.ts`): the standard GPL-3.0-or-later preamble plus a "Modified version of …" note where the code is ported.
- Core short header (see `C:/dev/hodoku_revisited/packages/core/src/index.ts`):
  ```ts
  /*
   * Hodoku Revisited - a TypeScript port of HoDoKu.
   * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
   * Copyright (C) 2026 Hodoku Revisited contributors
   * GPL-3.0-or-later; see LICENSE.
   */
  ```
- App short header (see `C:/dev/hodoku_revisited/packages/app/src/game.ts`):
  ```ts
  /*
   * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
   * Game state: pure functions, no React, no DOM.
   */
  ```

## Comments & JSDoc

- Public functions and types get JSDoc (`/** ... */`) describing **what and why**, not how. Examples throughout `C:/dev/hodoku_revisited/packages/core/src/sudoku2.ts` and `C:/dev/hodoku_revisited/packages/app/src/protocol.ts`.
- JSDoc references use `{@link name}` (`{@link parseSudoku}`, `{@link formatSudoku}`).
- Inline comments explain non-obvious invariants and porting decisions — e.g. `// bit d-1 = digit d. 0 means "cell already set"` and the "Differences to the Java original" block in `sudoku2.ts`.
- Comments note backward compatibility where fields are optional: `/** … (missing in older saves) */` in `GameState` (`C:/dev/hodoku_revisited/packages/app/src/game.ts`).

## Error Handling

- **Validation throws** a plain `Error` with a human-readable message. In `C:/dev/hodoku_revisited/packages/app/src/solverApi.ts`:
  ```ts
  if (81 - s.unsolvedCellsAnz < 17) throw new Error('A sudoku needs at least 17 givens.');
  if (count === 0) throw new Error('This puzzle has no solution.');
  if (count > 1) throw new Error('This puzzle has more than one solution.');
  ```
- Tests assert the message shape with `expect(() => fn()).toThrow(/81/)`.
- **Best-effort persistence swallows errors silently** rather than crashing. In `C:/dev/hodoku_revisited/packages/app/src/store.ts`:
  ```ts
  export function loadJson<T>(store: Store, key: string, fallback: T): T {
    try {
      const raw = store.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  ```
  `saveJson` likewise `catch { /* private mode or full: the data just isn't remembered */ }`.
- **Worker errors** cross the boundary as a message variant, not a thrown exception: `{ id, kind: 'error', message }` in `WorkerResponse` (`C:/dev/hodoku_revisited/packages/app/src/protocol.ts`).

## Logging

No logging framework and no `console.log` in the library/app code. The website build script and scripts may print status to the console (`packages/website/src/build.mjs`), but there is no structured logging convention.

## Function Design

**Size:** functions stay small and single-purpose; helpers are factored freely (see `C:/dev/hodoku_revisited/packages/app/src/aiCoach.ts`, which is a stack of small named helpers like `unitName`, `sharedHouse`, `cellCandidates`).

**Purity:** state changes are **pure and immutable**. `C:/dev/hodoku_revisited/packages/app/src/game.ts` never mutates — every action returns a new `GameState` (`return { ...g, values, cands, notes, past, future }`), with `past`/`future` snapshots for undo/redo. Callers reassign: `g = setValue(g, cell, d)`.

**Dependency injection over mocking:** `store.ts` takes a `Store` interface (`get`/`set`) instead of touching `localStorage` directly, so tests pass an in-memory stub.

**Parameters:** configuration objects for optional args, e.g. `imposePages(count, layout, booklet)` and `BoardImageOptions` in `C:/dev/hodoku_revisited/packages/app/src/boardImage.ts`.

## Module Design

**Barrel files:** the core exposes its public API through `C:/dev/hodoku_revisited/packages/core/src/index.ts`. Named re-exports with `export type` for types.

**Private helpers** are simply not exported — no `_` prefix. Example: `snapshot`, `push` in `game.ts` are module-local `function`s.

**Generated files are not edited** (documented in `C:/dev/hodoku_revisited/AGENTS.md`):
- `packages/core/src/generated/*` (`defaultSteps.ts`, `solutionType.ts`) — from `scripts/gen-tables.py`.
- `packages/app/src/bank/bank.json`, `packages/website/src/examples.json` — build outputs.
Edit the sources, not these outputs.

## UI Conventions

- UI copy is plain **American English** (color, practicing, behavior). A website test fails on British spellings — see `C:/dev/hodoku_revisited/packages/website/test/build.test.mjs` line 146.
- The stored game-mode value `'practising'` is a persisted contract and is never renamed; only its displayed label changes to "Practicing".
- Refer to the assistant as **"AI Coach"** or **"Socratic Coach"**, never a chatbot/LLM (deterministic, local logic).
- Component props use a local `interface Props` and destructured function params (see `C:/dev/hodoku_revisited/packages/app/src/components/DigitPad.tsx`).

## Commit & PR Conventions

- Commit subjects: `Area: summary`, lowercase after the colon — `App: …`, `Website: …`, `Docs: …`.
- Short descriptive branch names.
- Every change goes through a PR; `main` is protected and deploys live.

---

*Convention analysis: 2026-11-03*
