# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read this before writing code — the invariants below are load-bearing and
enforced by lint/CI.

## What this is

**Ward Round** — a hospital-ward management simulation. Stage 1 is a headless
discrete-event simulation (DES) of a single NHS elective general medicine ward,
plus a minimal SvelteKit UI.

Authoritative documents (read in this order):

- [docs/STAGE-1-SPEC.md](docs/STAGE-1-SPEC.md) — *what* Stage 1 is and *why*.
- [docs/STAGE-1-DESIGN.md](docs/STAGE-1-DESIGN.md) — *how* it is built (architecture).
- [docs/STAGE-1-TODO.md](docs/STAGE-1-TODO.md) — the section-by-section build plan.

When in doubt, the spec wins on behaviour, the design wins on structure.

## Architecture invariants (do not violate)

**The engine is a neutral DES machine.** `packages/engine` moves patients through
resources and rolls outcomes. It knows **nothing** of Svelte, HTTP, HL7/FHIR,
money, or scoring. Those are layers that *read from* the engine. If you find
yourself importing a framework or a sibling package into the engine, stop.

**Dependency direction is one-way and lint-enforced:**

```
web → host → scoring → engine
web → contract → engine
```

- `engine` depends only on `tinyqueue` (a tiny priority-queue utility) — no
  framework, no sibling packages, no HTTP. The RNG, clock, and id generator are
  hand-rolled on purpose (they encode determinism/save-format contracts).
- `contract` depends only on the engine's public domain-event types.
- `scoring` / `host` depend only on the engine's public API.
- `web` is thin presentation glue.

A `no-restricted-imports` rule fails the build if `engine` imports `svelte`, a
sibling package, or node HTTP. Do not work around it — it is the boundary.

**Determinism is required.** All stochasticity flows from a single seeded RNG
(mulberry32) carried in `EngineConfig.seed`, with forked sub-streams per concern.
**`Math.random()` is banned in the engine.** Identical `(config + seed)` must
produce identical output — this is what makes the tests and the save/replay story
work.

**Two event tiers.** The engine emits fine-grained *domain events* (an
implementation detail, free to change). `packages/contract` translates a coarse,
**versioned** subset into *business events* — that schema is a published contract
and must not break without a `schemaVersion` bump. The contract schema is authored
in **TypeSpec** under `packages/contract/schema/`; TS types are emitted from it,
never hand-maintained in parallel.

## Repository layout

```
ward-round/
  CLAUDE.md, README.md, .editorconfig, .gitattributes, .github/, docs/
  app/                 # the entire TypeScript world (npm workspaces rooted HERE)
    packages/
      engine/  contract/  scoring/  host/
    web/               # SvelteKit UI (no `apps/` plural — one front end)
```

**Keep the root clean.** Nothing lives at the repo root unless it is genuinely
repo-wide. Polyglot scaffolding (a `services/` backend in Go or C#, a root task
runner, a promoted top-level contract schema) arrives only when the backend does —
not before.

## Testing & coverage

- **Vitest** for unit + engine acceptance scenarios; **Playwright** for UI e2e.
- **Hard coverage gate (CI fails below):** `engine`, `contract`, `scoring`,
  `host` at **100% line + branch**; `web` at **~80%**.
- Pure logic lives in packages (testable to 100%), not in Svelte components.
- No `istanbul ignore` escapes without a justification raised in review.
- Determinism makes 100% achievable: inject a scripted RNG to exercise every
  stochastic branch.

## Cross-platform

Development happens on **Windows and macOS**; CI runs on Linux.

- LF line endings everywhere (`.gitattributes`: `* text=auto eol=lf`).
- No OS-specific scripts — cross-platform tooling only, no hard-coded path
  separators.
- Node is pinned (Node 24) via `app/package.json` `engines` + `volta`.
- `forceConsistentCasingInFileNames` is on so casing bugs fail locally, not just
  on Linux CI.

## Conventions

- TypeScript strict mode throughout; ESLint + Prettier.
- **Indentation: 4 spaces for code (TS/JS/Svelte), 2 spaces for data/content
  (JSON, YAML, Markdown).** `.editorconfig` is the source of truth; Prettier is
  configured to match.
- Match the style of surrounding code.

## Commands

All commands run from `app/` (the npm-workspaces root).

```
npm install                       # install workspace deps
npm run dev                       # SvelteKit dev server (web app)
npm run typecheck                 # tsc --noEmit across packages + svelte-check for web
npm run lint                      # ESLint + Prettier --check
npm run format                    # Prettier --write
npm test                          # Vitest (all projects) + the hard coverage gate
npm run test:watch                # Vitest watch mode
npm run test:e2e                  # Playwright e2e (builds + previews the web app)
npm run build                     # build the web app
```

Running a subset of tests:

```
npx vitest run --project engine                 # one package's tests
npx vitest run packages/engine/src/index.test.ts # one file
npx vitest run -t "queue grows"                 # by test name
```

Notes:
- Coverage is configured in `app/vitest.config.ts` (one Vitest project per
  package). `npm test` enforces the gate; CI fails on any shortfall.
- Git hooks are intentionally not configured — CI is the gate (keeps the repo
  root clean). Run `npm run lint` / `npm test` before pushing.
- ESLint currently skips `.svelte` files (svelte-check covers them); component
  linting is added in §12 of the TODO.
