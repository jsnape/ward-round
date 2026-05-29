# Ward Round

A hospital-ward management simulation. Stage 1 is a headless discrete-event
simulation (DES) of a single NHS elective general medicine ward, plus a minimal
SvelteKit UI.

## Documentation

- [docs/STAGE-1-SPEC.md](docs/STAGE-1-SPEC.md) — what Stage 1 is and why.
- [docs/STAGE1-DESIGN.md](docs/STAGE1-DESIGN.md) — how it is built (architecture).
- [docs/STAGE-1-TODO.md](docs/STAGE-1-TODO.md) — the section-by-section build plan.
- [CLAUDE.md](CLAUDE.md) — working conventions and invariants.

## Layout

All TypeScript lives under [`app/`](app), an npm-workspaces monorepo:

| Package | Purpose |
|---------|---------|
| `packages/engine` | Pure DES engine — zero deps, no framework. |
| `packages/contract` | Versioned business-event schema (TypeSpec) + save format. |
| `packages/scoring` | NHS-mode scoring read-layer. |
| `packages/host` | Framework-agnostic simulation driver. |
| `web` | SvelteKit UI. |

## Getting started

Requires **Node 24+**. From the `app/` directory:

```sh
npm install
npm test          # unit + scenario tests with the coverage gate
npm run lint      # ESLint + Prettier
npm run typecheck # tsc across the workspace
npm run build     # build all packages + the web app
```
