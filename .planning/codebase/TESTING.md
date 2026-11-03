---
last_mapped_commit: 3b3ec17d9ff5204ecb014376389f129395489040
last_mapped_at: 2026-11-03
---
# Testing Patterns

**Analysis Date:** 2026-11-03

## Test Frameworks

| Package | Runner | Config | Test command |
|---------|--------|--------|--------------|
| `@hodoku/core` | Vitest 5 | `C:/dev/hodoku_revisited/packages/core/vitest.config.ts` | `vitest run` |
| `@hodoku/app` | Vitest 5 | `C:/dev/hodoku_revisited/packages/app/vitest.config.ts` | `vitest run --passWithNoTests` |
| `@hodoku/website` | Node built-in (`node --test`) | none | `node --test test/build.test.mjs` |

**Assertion libraries:**
- Vitest packages use `expect` from `'vitest'` (`import { describe, expect, it } from 'vitest'`).
- Website uses `assert` from `'node:assert/strict'` and `test` from `'node:test'`.

**Run commands (from repo root `C:/dev/hodoku_revisited`):**
```bash
pnpm test                                        # every package
pnpm --filter @hodoku/core test
pnpm --filter @hodoku/app test
pnpm --filter @hodoku/website test               # builds the site, then asserts on output
pnpm typecheck                                   # tsc across packages; node --check for website
```

CI (`C:/dev/hodoku_revisited/.github/workflows/ci.yml`) runs `pnpm typecheck`, `pnpm test`, the app build, the website build, and the website test on every push/PR, on Node 22 with pnpm 10.

## Test Timeouts

Vitest 5 enforces its default 5 s timeout on synchronous tests, so both packages raise it because the solver is slow:

- Core — `C:/dev/hodoku_revisited/packages/core/vitest.config.ts`:
  ```ts
  export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 600_000, hookTimeout: 600_000 } });
  ```
- App — `C:/dev/hodoku_revisited/packages/app/vitest.config.ts`:
  ```ts
  export default defineConfig({
    plugins: [react()],
    test: { include: ['test/**/*.test.ts'], testTimeout: 120_000, hookTimeout: 120_000 },
  });
  ```

Per-test overrides pass a timeout as the `it` third argument, e.g. `it('...', () => { ... }, 30_000)` in `C:/dev/hodoku_revisited/packages/app/test/solverApi.test.ts`.

## Test File Organization

**Location:** tests are **not co-located** with source. Each package keeps them in a top-level `test/` directory:

- Core: `C:/dev/hodoku_revisited/packages/core/test/`
- App: `C:/dev/hodoku_revisited/packages/app/test/`
- Website: `C:/dev/hodoku_revisited/packages/website/test/build.test.mjs` (single file)

**Naming:** `*.test.ts` (Vitest) or `*.test.mjs` (Node). No `*.spec.*`, no `__tests__` directories.

**Fixtures:** `C:/dev/hodoku_revisited/packages/core/test/fixtures/` holds golden data — `golden.jsonl`, `golden-hard.jsonl`, `golden-templates.jsonl`, `golden-kraken.jsonl`, `golden-ts.jsonl`, and compressed `golden-all.jsonl.gz`.

## Test Structure

Standard `describe` / `it` blocks with nested describes per feature area. A shared `const PUZZLE` string and small local helpers set up state:

```ts
import { describe, expect, it } from 'vitest';
import { Sudoku2 } from '../src/sudoku2.js';

const PUZZLE = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';

function load(text: string): Sudoku2 {
  const s = new Sudoku2();
  s.setSudoku(text);
  return s;
}

describe('input formats', () => {
  it('reads 81 characters with 0 or . and a trailing comment', () => {
    expect(load(PUZZLE.replace(/\./g, '0')).getCluesString()).toBe(PUZZLE);
  });
  it('rejects wrong cell counts', () => {
    expect(() => load('123')).toThrow(/81/);
  });
});
```

No `beforeEach`/`afterEach`/`beforeAll`/`afterAll` hooks are used anywhere in the repo — tests are self-contained and build their own state per test. No `.skip`/`.only`/`.todo` either.

## Golden / Parity Testing (core)

The engine is verified **step by step against the original Java HoDoKu 2.2.0**:

- `C:/dev/hodoku_revisited/packages/core/test/golden.test.ts` — runs the TS solver in lockstep with recorded Java solutions for 200 puzzles; asserts identical step type, cells, digits, and eliminations, then matching score/level/result.
- `C:/dev/hodoku_revisited/packages/core/test/findall.test.ts` — compares "find all steps" for every technique against golden state dumps.

Pattern: load fixtures with `readFileSync` + `gunzipSync` where gzipped (`findall.test.ts` lines 24–28), then iterate. The AGENTS.md rule: **never change solver output to make a golden test pass — a golden diff is a bug in your change.**

## Mocking & Isolation

**No `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.stub`, or `vi.useFakeTimers` anywhere** — zero matches in the repo. Isolation is achieved by **dependency injection and pure functions**:

- `C:/dev/hodoku_revisited/packages/app/src/store.ts` defines a narrow `Store` interface and takes it as a parameter; tests pass an in-memory stub:
  ```ts
  function memoryStore(): Store {
    const map = new Map<string, string>();
    return { get: (key) => map.get(key) ?? null, set: (key, value) => void map.set(key, value) };
  }
  ```
  (`C:/dev/hodoku_revisited/packages/app/test/store.test.ts` lines 5–8.)
- `commands.test.ts` builds a fake `CommandContext` with recording functions and a getter-backed `settings`, so the command builder can be exercised without React.
- `solverApi.ts`, `game.ts`, `aiCoach.ts` are pure functions on top of `@hodoku/core`; they are unit-tested directly with no worker or DOM.

## Fixtures and Factories

- Test data is **local string constants** — a single 81-char puzzle `const PUZZLE = '...'` is reused across most app and core tests.
- Determinism is asserted through a **seeded RNG**: `seededRng(42)` yields identical puzzles, `seededRng(43)` differs (`C:/dev/hodoku_revisited/packages/core/test/generator.test.ts`).
- Independent oracle helpers verify the implementation rather than the implementation itself, e.g. `countSolutions` (a standalone backtracking counter) in `generator.test.ts`.

## Coverage

No coverage configuration, no coverage script, and no coverage threshold is enforced. To view coverage if needed, run Vitest with `--coverage` (not currently wired up).

## Test Types

**Unit tests** — the bulk. Pure-function tests over core classes (`Sudoku2`, `SudokuSet`, `SinglesQueue`), app state (`game.ts`, `store.ts`, `commands.ts`, `urlParams.ts`, `ui.ts`, `extendedPrint.ts`, `boardImage.ts`), and hook predicates (`isNotesToggleShortcut`).

**Golden / parity tests** — core `golden.test.ts` and `findall.test.ts` (see above).

**Integration tests (website)** — `C:/dev/hodoku_revisited/packages/website/test/build.test.mjs` builds the entire site (`execFileSync('node', ['src/build.mjs'], ...)`) and asserts on the generated HTML: link resolution, consent/AdSense gating, sitemap/robots, diagrams, skip links, and a spelling check that rejects British spellings. It also rebuilds with `SITE_PASSWORD` set to test the gate without leaking the password.

**Component / E2E tests** — **not used.** There is no React Testing Library, `@testing-library/*`, jsdom, Playwright, or Cypress. React components and hooks are tested only through the pure logic they extract (e.g. `isNotesToggleShortcut` from `useHotkeys.ts`). The app's `react()` plugin is configured in `vitest.config.ts` but no test renders components.

## Common Patterns

**Async testing:** minimal — tests are synchronous (the solver is synchronous). Where async exists it is `await import(...)` in the website test, resolved at top level.

**Error testing:** assert the throw and the message shape:
```ts
expect(() => analyze('.'.repeat(81))).toThrow();
expect(() => load('123')).toThrow(/81/);
```

**Table-driven / property testing:** loops inside a single `it` to check invariants over all cells or all layouts, e.g. iterating `for (let i = 0; i < 81; i++)` in `sudoku2.test.ts`, or the `imposePages` layout matrix in `extendedPrint.test.ts`.

---

*Testing analysis: 2026-11-03*
