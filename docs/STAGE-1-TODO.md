# Stage 1 Implementation TODO

Working checklist for building Stage 1, derived from [STAGE-1-DESIGN.md](STAGE-1-DESIGN.md)
and [STAGE-1-SPEC.md](STAGE-1-SPEC.md).

**How to use this doc**

- Sections are ordered to be built in sequence; each builds on the last.
- Every section opens with **❓ Outstanding questions** (answer these before
  starting that section), then a **Description**, then **Acceptance criteria**,
  then the **Tasks** checklist.
- Tick tasks as they land. Return any time; the next unchecked section is the
  next thing to do.
- Questions marked **(blocking)** must be answered before the section can start;
  others have a sensible default in brackets that we proceed with if unanswered.

**Progress overview**

- [x] §0 — Claude Code initialization (CLAUDE.md)
- [x] §1 — Repo skeleton, tooling & coverage gate
- [x] §2 — Engine: primitives (RNG, heap, clock, ids)
- [x] §3 — Engine: domain model (state, transitions, treatment, arrivals)
- [x] §4 — Engine: domain events & emitter
- [x] §5 — Engine: DES scheduler & Simulation orchestration
- [ ] §6 — Engine: handlers (the lifecycle glue)
- [ ] §7 — Engine: acceptance scenarios & determinism
- [ ] §8 — Contract: schema/IDL, envelope & translator
- [ ] §9 — Contract: sinks, save format & migration
- [ ] §10 — Scoring package
- [ ] §11 — Host package (sim driver)
- [ ] §12 — Web app: UI
- [ ] §13 — Web app: e2e & final wiring

---

## §0 — Claude Code initialization (CLAUDE.md)

### ❓ Outstanding questions

- Any conventions to bake into `CLAUDE.md` beyond what the spec and design docs
  already state? [default: none — derive guardrails from STAGE-1-SPEC.md +
  STAGE-1-DESIGN.md]

### Description

Before any code is written, establish a root `CLAUDE.md` so every subsequent
session inherits the project's architecture invariants, conventions, and commands.
This is deliberately first: §1 onward must be built under these guardrails, not
have them retrofitted. The file is seeded now from the design docs; once the
skeleton exists (§1) it is refined with `/init` so the documented build/test/lint
commands are real and verified.

### Acceptance criteria

- `CLAUDE.md` exists at the repo root and is concise (a working reference, not a
  copy of the design doc).
- It captures the load-bearing invariants: the `web → host → scoring → engine` /
  `web → contract → engine` dependency direction; the engine's zero-knowledge
  boundary (no Svelte/HTTP/HL7/scoring); determinism rules (seeded RNG only,
  `Math.random()` banned); the coverage discipline (100% pure packages / 80% web);
  and the monorepo layout (`app/` root, no `apps/` plural, clean repo root).
- It records cross-platform rules (Windows + macOS; LF line endings; no
  OS-specific scripts) and the canonical build/test/lint commands.
- It links to [STAGE-1-SPEC.md](STAGE-1-SPEC.md), [STAGE-1-DESIGN.md](STAGE-1-DESIGN.md),
  and this TODO.
- A fresh session reading only `CLAUDE.md` understands the boundaries it must not
  cross.

### Tasks

- [x] Author root `CLAUDE.md` from the spec + design docs.
- [x] Document the dependency direction and the engine purity boundary.
- [x] Document determinism rules (seeded RNG, no `Math.random()`).
- [x] Document the coverage gate and testing approach (Vitest + Playwright).
- [x] Document the monorepo layout and clean-root rule.
- [x] Document cross-platform rules + canonical commands (placeholders until §1).
- [x] Link the spec, design, and TODO docs.
- [x] After §1 lands, run `/init` to refine and verify the commands (CLAUDE.md
      updated with verified commands + required header). Commit pending user go-ahead.

---

## §1 — Repo skeleton, tooling & coverage gate

### ❓ Outstanding questions

- **Linter/formatter:** ESLint + Prettier. ✅ (chosen)
- **Node version:** Node 24, pinned in `app/package.json` engines/volta. ✅ (chosen)
- Package manager confirmed npm workspaces (per design). Keep, or prefer pnpm?
  [default: npm, as decided]
- Commit hooks (lint/test on pre-commit via husky/lefthook) in Stage 1, or rely
  on CI only? [default: lefthook, lint + typecheck on pre-commit]

### Description

Stand up the monorepo exactly as [STAGE-1-DESIGN.md §2](STAGE-1-DESIGN.md) specifies:
clean root, self-contained `app/` workspace, the four empty package shells plus
`web`, strict shared TS config, the Vitest workspace with the **hard coverage
gate wired before any feature code**, Playwright config, the import-boundary lint
rule, and CI. Cross-platform hygiene (§2a) is set up here too.

### Acceptance criteria

- `app/` workspace installs cleanly on Windows and macOS with Node 24.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` all run from
  `app/` and pass on an empty skeleton.
- Coverage gate is active: a deliberately uncovered line in a package fails
  `npm test`. Engine/contract/scoring/host thresholds = 100% line+branch; web = 80%.
- The import-boundary rule fails the build if `packages/engine` imports `svelte`,
  a sibling package, or node HTTP.
- CI runs lint + typecheck + unit + e2e + coverage on push and fails on any gap.
- Root contains only: `README.md`, `.editorconfig`, `.gitattributes`, `.github/`,
  `docs/`, `CLAUDE.md`, `app/`.

### Tasks

- [x] Create minimal root: `README.md`, `.editorconfig`, `.gitattributes`
      (`* text=auto eol=lf`), `.github/`. (also added `.gitignore`)
- [x] Create `app/` with `package.json` (workspaces `["packages/*","web"]`, Node 24
      pin via `engines` + `volta`; `engines` set to `>=24` so local Node 25 works).
- [x] Add `app/tsconfig.base.json` (strict, `forceConsistentCasingInFileNames`).
- [x] Scaffold empty packages: `packages/engine`, `packages/contract`,
      `packages/scoring`, `packages/host`, each with `package.json`, `tsconfig`,
      `src/index.ts` (+ a version anchor test each to seed the gate).
- [x] Scaffold `web` (SvelteKit + Tailwind v4 + `@lucide/svelte` + TS).
- [x] Configure ESLint + Prettier + the `no-restricted-imports` boundary rule
      (engine cannot import svelte / siblings / http). `.svelte` ESLint deferred
      to §12; svelte-check covers components meanwhile.
- [x] Add `app/vitest.config.ts` (Vitest v3 `projects`, replaces the deprecated
      `vitest.workspace.ts`) with coverage thresholds (100% pure / 80% web).
- [x] Add `app/playwright.config.ts` (+ a smoke e2e) targeting the previewed web app.
- [~] Commit hooks: **decided CI-only** (lefthook config wants the git root, which
      fights the clean-root rule). Run lint/test before pushing.
- [x] Add `.github/workflows/ci.yml`: install → lint → typecheck → test+coverage,
      separate e2e job, scheduled macOS/Windows drift job.
- [x] Prove the gate: temporary uncovered branch made `npm test` exit 1 (lines
      79.16% < 100%); reverted → 9 tests pass, 100%, exit 0.

---

## §2 — Engine: primitives (RNG, heap, clock, ids)

### ❓ Outstanding questions

- None expected. (RNG = hand-rolled mulberry32, event queue = `tinyqueue`
  library, ids = seeded counter — sourcing settled with the user.)

### Description

The dependency-free building blocks under `packages/engine/src`: the seedable
forkable `Rng`, the `SimClock` (integer-ms, monotonic), and the deterministic id
counter. The event-queue need is met by the `tinyqueue` library (comparator
carries the `time → seq` tiebreak) rather than a hand-rolled heap. These have no
domain knowledge and are the foundation everything else stands on.

### Acceptance criteria

- `Rng` produces a documented golden sequence for a fixed seed; `fork(label)`
  yields an independent stream; `getState`/`setState` round-trips exactly.
- `tinyqueue` is used for the event queue, driven by a comparator that breaks
  ties by insertion `seq` (the scheduler's job in §5); behaviour spot-checked.
- `SimClock` rejects backwards time (throws) and exposes current `simTime`.
- `id` counter is deterministic (`p-1`, `p-2`, …) and resettable per simulation.
- **100% line + branch coverage** on all four modules.

### Tasks

- [x] `rng/rng.ts`: `Rng` interface + mulberry32 + `fork` + `getState/setState` +
      `weightedPick` helper.
- [x] Adopt `tinyqueue` for the event queue (replaces hand-rolled heap; comparator
      carries the `time → seq` tiebreak). Added as the engine's one runtime dep.
- [x] `sim/clock.ts`: `SimClock` with monotonic guard.
- [x] `util/id.ts`: deterministic seeded id generator.
- [x] Unit tests: rng golden sequence, fork independence, state round-trip.
- [x] Verify `tinyqueue` behaviour (comparator + `time → seq` tiebreak, drains
      cleanly) — spot-checked; full usage covered by the §5 scheduler tests.
- [x] Unit tests: clock monotonic guard; id determinism.
- [x] All engine primitives at 100% line+branch (41 tests pass; lint/typecheck clean).

---

## §3 — Engine: domain model (state, transitions, treatment, arrivals)

### ❓ Outstanding questions

All resolved by accepting the documented defaults (user: "use the defaults"):

- **Outcome tier weights:** good 0.70 / complication 0.20 / poor 0.10. ✅
- **Treatment duration classes:** 3 — short 1d, medium 3d, long 7d (sim-ms). ✅
- **Urgency levels:** 3 (routine/urgent/emergency); Stage 1 schedules **FIFO**,
  urgency recorded but not yet acted on. ✅
- **Staffing floors:** min 1 doctor & 1 nurse; `softBonusPerExtra` = 0.1. ✅
- **Arrival rate:** exponential, mean 1/day (tunable in config). ✅

### Description

The pure domain math under `model/` and the data shapes under `state/`: the
`PatientState` machine with its guarded transition table, the `Patient` and
`ResourceState` types, `throughputMultiplier`, the 3-tier outcome roll, and the
exponential arrival sampler. All pure functions — no scheduling, no emission.

### Acceptance criteria

- Every legal transition succeeds; every illegal transition throws (table-driven).
- `throughputMultiplier` returns 0 below either staffing floor and
  `1 + bonus*(extra)` at/above; covered for doctor-floor, nurse-floor, at-floor,
  above-floor.
- Outcome roll lands in each of good/complication/poor and on the tier boundaries
  given scripted RNG floats; observed distribution matches weights within tolerance.
- Arrival sampler draws exponential inter-arrival times from the arrivals stream.
- **100% line + branch coverage.**

### Tasks

- [x] `state/patient.ts`: `PatientState` enum, `Patient`, `Urgency`,
      `DurationClass`, `OutcomeTier` (+ ordered constant arrays, `createPatient`).
- [x] `state/resources.ts`: `ResourceState` (beds int; doctor/nurse headcount) +
      `createResourceState`, `freeBeds`, `hasFreeBed`.
- [x] `model/transitions.ts`: allowed-transition table + guarded pure transition fns
      (both `Scheduled→Cancelled` and `Admitted→Cancelled` edges).
- [x] `model/treatment.ts`: `throughputMultiplier`, `isStaffed`, `treatmentDuration`,
      3-tier `rollOutcome`.
- [x] `model/arrivals.ts`: exponential `nextInterArrival` + `drawUrgency` /
      `drawDurationClass`.
- [x] `config/types.ts` + `config/defaults.ts`: `EngineConfig` etc. with the agreed
      default values.
- [x] Unit tests for each to 100% (59 engine tests; full suite green, lint/typecheck clean).

---

## §4 — Engine: domain events & emitter

### ❓ Outstanding questions

- Domain-event variant list used as listed in
  [STAGE-1-DESIGN.md §7.1](STAGE-1-DESIGN.md). ✅ (defaults). `GameStarted`
  carries an **engine-native** `EngineConfigSummary` (seed + capacities) — mode and
  budget are added by the contract layer in §8, keeping the engine scoring-ignorant.

### Description

The tier-1 `DomainEvent` discriminated union and the synchronous `DomainEmitter`
(subscribe returns unsubscribe; fan-out happens within `step()`). These are the
engine's own vocabulary; the contract and UI subscribe to them.

### Acceptance criteria

- `DomainEvent` union compiles with exhaustive type guards; every variant carries
  `simTime`.
- `DomainEmitter` delivers events to all subscribers synchronously, in emission
  order; unsubscribe stops delivery; no listener leak.
- **100% line + branch coverage.**

### Tasks

- [x] `domain/events.ts`: `DomainEvent` union + `DOMAIN_EVENT_KINDS`,
      `isDomainEvent` (trust-boundary guard), `isEventKind` (narrowing).
- [x] `domain/emitter.ts`: `subscribe` (returns unsubscribe) + synchronous `emit`
      fan-out in subscription order.
- [x] Unit tests: fan-out order, multi-subscriber, unsubscribe, no-listener no-op,
      guard accept/reject paths. (80 tests total; 100%, lint/typecheck clean.)

---

## §5 — Engine: DES scheduler & Simulation orchestration

### ❓ Outstanding questions

- `runUntil` safety max-iterations bound: configurable via `SimulationDeps`,
  default 1e6. ✅

### Description

The `EventScheduler` (min-heap of `ScheduledEvent`, comparator
`time → seq`) and the `Simulation` orchestrator that wires clock + scheduler +
state + rng + emitter and exposes the public advancement API (`step`, `runUntil`,
`run`, `subscribe`, `state`). `createSimulation(config)` and the
`createSimulationFromSnapshot` entry point (the latter's body can follow §9).

### Acceptance criteria

- `step()` advances exactly one event, advances `simTime` monotonically, returns
  `false` on empty queue.
- `runUntil(t)` processes all events with `time <= t` and leaves `simTime === t`.
- `run(maxEvents)` runs headless to cap/quiescence.
- Same-timestamp events execute in FIFO (`seq`) order.
- The max-iteration guard throws on a pathological same-timestamp burst (tested).
- `state` returns a fresh immutable `WorldStateReadModel`.
- **100% line + branch coverage.**

### Tasks

- [x] `sim/scheduler.ts`: `ScheduledEvent` union + input type, `time → seq`
      comparator over `tinyqueue`, schedule/peek/pop/size.
- [x] `state/worldState.ts`: `WorldState` aggregate + counters + immutable
      `WorldStateReadModel` projection.
- [x] `sim/simulation.ts`: orchestrator + public `Simulation` API + `createSimulation`.
      Lifecycle logic is injected via `HandlerRegistry` + `bootstrap` (the ward
      handlers land in §6); `start()` emits `GameStarted` (idempotent).
      `createSimulationFromSnapshot` deferred to §9.
- [x] `index.ts`: public barrel (construction, types, enums, model, rng, config).
- [x] Unit tests: step/runUntil/run semantics, FIFO tiebreak, simTime-at-bound,
      no-backwards, max-iteration guard, no-handler throw, read-model immutability,
      subscribe/unsubscribe. (103 tests total; 100%, lint/typecheck clean.)

---

## §6 — Engine: handlers (the lifecycle glue)

### ❓ Outstanding questions

- Confirm Stage 1 keeps the simplification: staffing floor gates **starting** new
  treatments; in-flight treatments finish even if staff later drop. [default: yes]

### Description

The handlers the scheduler invokes — arrival, schedule (A05), admit (A01/A11
bed-check + cancellation), treatment (timer + outcome roll), discharge (A03 +
bed release). Each mutates `WorldState`, emits domain events, and is
**idempotent / self-cancelling** (no-ops on stale events).

### Acceptance criteria

- Each handler performs the correct transition, mutates resources correctly, and
  emits the expected domain events in order.
- Admit handler cancels with `no_bed_available` when beds are full.
- Stale-event no-op path verified (e.g. `treatmentComplete` for a cancelled
  patient emits nothing, mutates nothing).
- Arrival handler reschedules the next arrival.
- **100% line + branch coverage.**

### Tasks

- [ ] `handlers/arrivalHandler.ts`
- [ ] `handlers/scheduleHandler.ts`
- [ ] `handlers/admitHandler.ts` (bed check + cancellation cause)
- [ ] `handlers/treatmentHandler.ts` (staffing gate, timer, outcome roll)
- [ ] `handlers/dischargeHandler.ts` (bed release, length-of-stay)
- [ ] Per-handler unit tests with scripted Rng + spy emitter, incl. stale no-op.

---

## §7 — Engine: acceptance scenarios & determinism

### ❓ Outstanding questions

- Tolerance band for the outcome-distribution scenario? [default: ±3% over 10k
  treatments]

### Description

End-to-end headless scenario tests that prove the emergent dynamics the spec
validates against, plus the determinism regression net. These are the engine's
"acceptance" layer (distinct from unit tests).

### Acceptance criteria

- Scenario: raising arrival rate makes the waiting list grow.
- Scenario: ample capacity keeps the queue bounded and produces discharges.
- Scenario: understaffing stalls treatment (zero discharges, patients pile up).
- Scenario: bed pressure produces `AdmissionCancelled` / `no_bed_available`.
- Scenario: two sims, same config+seed → deep-equal domain-event streams.
- Scenario: outcome-tier frequencies within tolerance of configured weights.
- Engine package overall still at **100% coverage**.

### Tasks

- [ ] `*.scenario.test.ts`: arrival-rate-grows-queue.
- [ ] capacity-relieves-queue.
- [ ] understaffing-stalls.
- [ ] bed-pressure-cancellations.
- [ ] determinism (deep-equal streams).
- [ ] outcome-distribution-within-tolerance.

---

## §8 — Contract: schema/IDL, envelope & translator

### ❓ Outstanding questions

- **Contract IDL:** TypeSpec, in `packages/contract/schema/`, emitting TS types
  (and later Go/C#). ✅ (chosen)
- Confirm the business-event `type` list from [STAGE-1-SPEC.md §8.3](STAGE-1-SPEC.md)
  is complete. [default: as listed, incl. `PatientScheduled`]

### Description

Stand up `packages/contract`: the **TypeSpec** schema (kept under `schema/`), the
generated TS envelope + payload types with the `SCHEMA_VERSION` constant, and the
translator that subscribes to domain events and shapes the coarse business subset
(keeping its own derived state for accumulated events like `BudgetUpdated`).
Generates UUIDs for `eventId`/`gameId`.

### Acceptance criteria

- TypeSpec schema defines the envelope (spec §8.3) and every Stage 1
  business-event type, with `schemaVersion` first-class.
- TS types are emitted from TypeSpec (not hand-maintained in parallel); generation
  is reproducible and checked in CI (emit + diff fails if stale).
- Translator maps each relevant domain event to the correct business event;
  derived/accumulated events compute correctly.
- Translator imports only the engine's public domain types (boundary holds).
- Carries the "DO NOT BREAK WITHOUT A VERSION BUMP" header.
- **100% line + branch coverage.**

### Tasks

- [ ] Add TypeSpec toolchain (`@typespec/compiler` + emitters) to the contract package.
- [ ] `packages/contract/schema/`: TypeSpec models for the envelope + all
      business-event types.
- [ ] Wire TS-type emission into the build (`npm run gen` / prebuild); commit the
      generated output and add a CI staleness check.
- [ ] `SCHEMA_VERSION` constant + re-export of generated envelope types.
- [ ] `translator.ts`: domain→business mapping + derived state + UUID generation.
- [ ] Unit tests: per-event mapping, derived events, version/envelope shape,
      generated-types-match-schema.

---

## §9 — Contract: sinks, save format & migration

### ❓ Outstanding questions

- **(blocking)** Should Stage 1 ship a working **save/load UI**, or just build &
  test the save *format* (load exercised in tests only)? [default: format + load
  entry point + tests now; save/load UI button is a §12 stretch task]
- Snapshot cadence for Stage 1? [default: snapshot on demand only; periodic
  cadence deferred]

### Description

The `BusinessEventSink` interface with `ConsoleSink` + `InMemorySink`, the
switched-off HTTP stub, and the **contract-owned versioned save format** (event
log + portable world-state snapshot) plus `createSimulationFromSnapshot` wiring
in the engine and the `migrate(vN→vN+1)` scaffold. See
[STAGE-1-DESIGN.md §7.3](STAGE-1-DESIGN.md) — this is the cross-version-save design.

### Acceptance criteria

- `InMemorySink` accumulates the ordered event log; `ConsoleSink` logs; HTTP sink
  is a no-op stub.
- Save = event log + portable snapshot (contract terms, no engine internals).
- Replay-from-log reconstructs recorded past state exactly (outcomes are recorded,
  never re-rolled).
- `createSimulationFromSnapshot(portable, newSeed)` rebuilds world state,
  re-derives pending future events, continues forward with a fresh RNG.
- Save round-trip test: snapshot → mutate → reload → equal.
- `migrate(v1→v2)` scaffold + at least one migration test.
- **100% line + branch coverage** (contract); engine load path also covered.

### Tasks

- [ ] `sinks.ts`: `BusinessEventSink` + `ConsoleSink` + `InMemorySink` + HTTP stub.
- [ ] `save/format.ts`: versioned save type (log + portable snapshot).
- [ ] `save/replay.ts`: fold event log → reconstructed past state.
- [ ] `save/migrate.ts`: migration registry + `v1→v2` scaffold.
- [ ] Engine `createSimulationFromSnapshot` + future-event re-derivation.
- [ ] Tests: round-trip, replay-exactness, migration, load-and-continue.

---

## §10 — Scoring package

### ❓ Outstanding questions

- **(blocking)** Starting **score formula** weighting throughput vs outcome
  quality, and per-discharge payment + budget values? [default: payment £X per
  discharge; score = discharges + Σ(tier weight); good +2 / complication +0 /
  poor −1 — placeholder for play-tuning]

### Description

`packages/scoring`: a pure read-layer computing NHS-mode score and budget state
from a `WorldStateReadModel` (and/or the business-event log). Payment per
discharge only; no credit for cancellations. Engine stays ignorant of it.

### Acceptance criteria

- Given a read-model, computes patients-treated, outcome-quality component, spend,
  and remaining budget deterministically.
- Cancellations contribute no payment.
- No dependency on a live engine instance (pure function of state).
- **100% line + branch coverage.**

### Tasks

- [ ] `scoring/score.ts`: pure scoring + budget functions.
- [ ] Wire agreed payment/budget/weights into config.
- [ ] Unit tests: per-tier contribution, cancellation = no pay, budget math.

---

## §11 — Host package (sim driver)

### ❓ Outstanding questions

- Speed multiplier presets for the UI? [default: pause, 1×, 2×, 5×]
- Default real-seconds-to-sim-time mapping? [default: tunable; start 1 real
  second = 1 sim-hour]

### Description

`packages/host`: the framework-agnostic driver that maps wall-clock delta ×
speed → sim-time budget and calls `runUntil`, holds pause/speed state, and never
targets the DOM. Pure arithmetic so it tests to 100% without a browser.

### Acceptance criteria

- Wall→sim mapping correct across all speed multipliers.
- Pause halts advancement; resume continues without time jump.
- Never calls `runUntil` with a backwards target.
- No DOM/Svelte imports.
- **100% line + branch coverage.**

### Tasks

- [ ] `host/driver.ts`: budget calc, pause/speed state, `runUntil` invocation.
- [ ] Unit tests: speed scaling, pause/resume, monotonic target, budgeting.

---

## §12 — Web app: UI

### ❓ Outstanding questions

- **(blocking)** Any layout/wireframe preference, or implementer's discretion for
  the minimal legible UI? [default: discretion, following spec §12]
- Include the save/load button in Stage 1 (stretch from §9)? [default: no]

### Description

The thin SvelteKit (Svelte 5 runes) + Tailwind + lucide-svelte UI: waiting list,
beds filling/emptying, queue length, clock, NHS score readout, bed/staff dials,
and pause/speed controls. Wires `host` to a `requestAnimationFrame` loop and the
contract translator to the local business stream. Presentation only — logic lives
in the packages.

### Acceptance criteria

- Renders live world state via the read-model; updates as the sim advances.
- Pause/speed controls drive the host; bed/staff dials change capacity.
- Score readout reflects the scoring package.
- No simulation/scoring logic embedded in components (only presentation + wiring).
- Component tests where meaningful; **web package ≥ 80% coverage.**

### Tasks

- [ ] App shell + Tailwind + lucide-svelte setup verified.
- [ ] rAF loop wiring `host` → runes reactive state.
- [ ] Components: waiting list, beds, queue length, clock, score readout.
- [ ] Controls: pause/speed, bed dial, staff dials.
- [ ] Subscribe contract translator to local business stream (console/in-memory).
- [ ] Component tests for dials/readouts.
- [ ] (stretch) Save/load button.

---

## §13 — Web app: e2e & final wiring

### ❓ Outstanding questions

- None expected.

### Description

Playwright end-to-end coverage of the real app and final cross-package wiring,
then empirical tuning of the score formula from headless runs (design §10 step 6).

### Acceptance criteria

- E2e: start a game; observe beds fill and the queue grow over time.
- E2e: pause/resume and speed change behave correctly.
- E2e: score updates as patients are discharged.
- Full CI green on Linux; periodic macOS/Windows job green.
- Score formula tuned from a headless run and committed as the new default.

### Tasks

- [ ] Playwright: start-game / beds-fill / queue-grows.
- [ ] Playwright: pause-resume / speed-change.
- [ ] Playwright: score-updates-on-discharge.
- [ ] Headless score-tuning run; update default weights.
- [ ] Confirm full CI matrix green.

---

## Cross-cutting definition of done (every section)

- [ ] Coverage thresholds met (100% pure packages / 80% web) with no `istanbul
      ignore` escapes unless justified in review.
- [ ] Lint + typecheck clean; import boundaries intact.
- [ ] Works on Windows and macOS.
- [ ] No engine knowledge of Svelte / HTTP / HL7 / scoring (boundary preserved).
