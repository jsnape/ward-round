# Stage 1 Technical Design — Elective General Medicine Ward

**Status:** Draft v0.1 — companion to [STAGE-1-SPEC.md](STAGE-1-SPEC.md) v0.2.
Architecture for review before code is written.

---

## 1. Purpose and relationship to the spec

This document implements [STAGE-1-SPEC.md](STAGE-1-SPEC.md). The spec owns
*what* and *why*; this design owns *how*. Where the spec resolved a design
question (three outcome tiers, hard-floor + soft-bonus staffing, per-discharge
payment, a distinct `Scheduled` state, `no_bed_available` cancellation cause),
this document takes it as settled and does not relitigate it.

The load-bearing architectural principle carried from the spec:

> **The simulation engine is a neutral machine that moves patients through
> resources and rolls outcomes. Money, scoring, the business-event contract, and
> the UI are layers that read from and write to that machine — never tangled
> into it.**

Every structural decision below exists to keep that boundary honest and
mechanically enforced.

---

## 2. Repository layout (polyglot monorepo)

This is a **polyglot monorepo** built to stay so. Stage 1 is entirely
TypeScript, but later stages add a backend in **Go or C#** (the event-hub server
of spec §8/§10). Two principles, in tension, resolved together:

1. **The TypeScript toolchain must not claim the repo root** — otherwise a future
   Go or C# subtree fights `package.json` for ownership of the top level.
2. **Keep the root as clean as possible** — nothing lives at the root unless it
   *must* be there.

The resolution: **each language owns a self-contained subtree; the root holds
only what is unavoidably repo-wide.** Crucially, the polyglot scaffolding
(`services/`, a shared contract IDL directory, a cross-language task runner) is
**not materialised in Stage 1** — empty placeholder directories are clutter. It
is added in the commit that introduces the backend, by which point it earns its
place. Stage 1's root is therefore minimal:

```
ward-round/
  README.md
  .editorconfig             // repo-wide indentation/charset — must be at root to cascade
  .gitattributes            // * text=auto eol=lf — repo-wide; git reads it from root
  .github/                  // workflows — GitHub requires this at root
  docs/
  app/                      // the entire TypeScript application + its packages, self-contained
    package.json            // workspaces ["packages/*","web"]; pins Node via engines + volta
    tsconfig.base.json      // strict TS base, extended by every package
    vitest.workspace.ts     // aggregates package vitest configs + coverage gate
    playwright.config.ts    // e2e against the web app
    packages/
      contract/             // versioned schema + save format + translator (cross-language boundary)
        schema/             // language-neutral IDL lives HERE for now (§7.2), not at root
      engine/               // pure TS DES — no framework; one util dep (tinyqueue)
      scoring/              // pure NHS scoring read-layer over engine state (headless-testable)
      host/                 // framework-agnostic sim driver: wall->sim time, pause/speed
    web/                    // SvelteKit UI — thin glue over host + scoring + engine
```

The TypeScript subtree is named `app/` (meaningful — "the application"), not after
its language. With a single front end there is no need for an `apps/` plural, so
`web/` sits directly under `app/` beside its supporting `packages/`. Everything
TypeScript-specific — the Node version pin (in `app/package.json` via `engines` +
`volta`, so **no root `.nvmrc`**), all configs, all scripts — lives under `app/`.
The two dotfiles that remain at root are genuinely repo-wide: git reads
`.gitattributes` from the root, and `.editorconfig` must cascade from the top.
`README.md`, `docs/`, and `app/` are the only visible entries. (When the backend
lands it becomes a sibling — `services/` — leaving `app/` as the front-end world
and the root still clean.)

**What arrives with the backend (not before):**

- `services/` — a future `event-hub` in Go (own `go.mod`) or C# (own solution),
  never entangled with `package.json`.
- A **root task runner** (e.g. `Taskfile.yml`) — the one language-neutral place
  that builds/tests "everything." Until there is a second language to orchestrate,
  `app/`'s own npm scripts suffice and a root runner would be ceremony.
- **Promotion of the contract IDL** from `app/packages/contract/schema/` to a
  shared top-level location, once a second language must consume it (§7.2).

CI runs each toolchain as its own job; in Stage 1 that is just the TypeScript
jobs, with Go/C# jobs added beside them later.

**Dependency direction within `app/` is one-way and enforced:**

```
web → host → scoring → engine
web → contract → engine
```

- **engine** depends only on `tinyqueue` (no framework, no HTTP, no HL7, no
  contract, no sibling packages).
- **scoring** depends only on the engine's public read-model + domain events.
- **host** depends only on the engine's public advancement API.
- **contract** depends only on the engine's public domain-event types.
- **web** is thin glue depending on host, scoring, contract, and engine.

A lint rule (`no-restricted-imports`) forbids `packages/engine` from importing
`svelte`, any sibling package, or node HTTP. The boundary fails the build if
crossed — it is not a convention.

Why these extra packages (cohesion): `scoring` and `host` are both
framework-agnostic and reusable headless (scoring for empirical score tuning and,
later, server-side scoring; host's wall→sim timing is pure arithmetic). Extracting
them lets each be held to **100% coverage** instead of being buried in the `~80%`
UI app, and keeps `web` as nothing but Svelte presentation glue.

---

## 2a. Cross-platform development (Windows + macOS)

Development happens on both Windows and macOS, and CI runs on Linux. The design
assumes nothing OS-specific and pins the toolchain so the three agree.

- **Line endings:** the root `.gitattributes` sets `* text=auto eol=lf`. All
  checkouts use LF in the repo; this prevents CRLF/LF churn and spurious diffs
  between Windows and Mac. The root `.editorconfig` enforces charset and
  indentation in every editor.
- **No OS-specific scripts.** `app/package.json` scripts use cross-platform tooling
  only — no PowerShell-only or bash-only commands, no hard-coded path separators.
  Node and the build tools handle path joining. (When the cross-language task
  runner arrives with the backend, it is held to the same rule.)
- **Pinned toolchain.** Node is pinned in `app/package.json` via `engines` +
  `volta` (corepack honours it too), so Windows and Mac resolve the same Node and
  package manager — no root `.nvmrc` needed. The Go/C# toolchains, when added, pin
  their versions the same way within their own subtree (`go.mod` toolchain
  directive; `global.json` for .NET).
- **Case sensitivity.** macOS and Windows are case-insensitive by default; Linux
  CI is not. TypeScript's `forceConsistentCasingInFileNames` (on under strict) is
  kept enabled so an import-casing mistake fails locally, not only in CI.
- **CI matrix.** CI runs on Linux for speed; a periodic macOS + Windows job guards
  against platform drift in the toolchain.

## 3. `packages/engine` — module layout

```
src/
  index.ts                 // public barrel — the ONLY supported import surface
  config/
    types.ts               // EngineConfig, TreatmentTypeConfig, OutcomeWeights, ResourceConfig, StaffingConfig
    defaults.ts            // a known-good default config (tests + UI bootstrap)
  sim/
    clock.ts               // SimClock — owns simTime (integer ms), monotonic guard
    scheduler.ts           // EventScheduler — wraps a tinyqueue priority queue + advancement
    simulation.ts          // Simulation — orchestrator wiring clock + scheduler + state + rng
  domain/
    events.ts              // DomainEvent discriminated union + type guards
    emitter.ts             // DomainEmitter — synchronous listener fan-out
  rng/
    rng.ts                 // Rng interface + mulberry32 impl + weightedPick helper
  state/
    patient.ts             // Patient entity, PatientState enum
    resources.ts           // ResourceState (beds int; doctor/nurse headcount)
    worldState.ts          // WorldState aggregate + WorldStateReadModel projection
  model/
    arrivals.ts            // arrival-process logic (schedules next registration)
    treatment.ts           // treatment duration + throughputMultiplier + 3-tier outcome roll
    transitions.ts         // pure, guarded state-transition functions + allowed-transition table
  handlers/
    arrivalHandler.ts      // ArrivalEvent -> register patient, reschedule next arrival
    scheduleHandler.ts     // WaitingList -> Scheduled (A05)
    admitHandler.ts        // Scheduled -> Admitted | Cancelled (bed check, A01/A11)
    treatmentHandler.ts    // Admitted -> InTreatment -> ReadyForDischarge (timer + roll)
    dischargeHandler.ts    // ReadyForDischarge -> Discharged (release bed, A03)
  util/
    id.ts                  // deterministic seeded id counter (NOT crypto uuid)
```

**Split rationale:**

- `sim/` is the *mechanism* — time and queue, no domain knowledge.
- `model/` is *pure domain math* — `(inputs) => result`, no emission, no
  scheduling. This is where 100% branch coverage is won cheaply.
- `handlers/` is the *glue* the scheduler invokes: it mutates `WorldState` and
  emits domain events.
- `state/` is the *data*.

The business-event layer is deliberately **not** in this package — it is a
consumer (see §7).

---

## 4. Time model — the discrete-event scheduler

The engine is a discrete-event simulation (DES), not a fixed-tick loop. Time
jumps from scheduled event to scheduled event.

- **Backing structure: a binary min-heap from `tinyqueue`** (a tiny, vetted,
  comparator-injected priority queue — the engine's single runtime dependency).
  At Stage 1 scale a sorted array would suffice, but a heap gives `O(log n)`
  insert/pop and survives later stages (an ED, transfers, far more in-flight
  patients). The `Scheduler` wraps it so the backing structure can be swapped
  internally without consumers noticing. (The RNG, clock, and id generator are
  hand-rolled because they encode determinism/save-format contracts the engine
  must own; the queue is a pure utility with no such contract, so a library is
  the right call.)

- **Scheduled event shape:**
  ```ts
  interface ScheduledEvent {
    readonly time: number;        // absolute simTime in integer ms
    readonly seq: number;         // monotonic insertion counter — FIFO tiebreak
    readonly kind: EventKind;     // 'arrival' | 'schedule' | 'admit' | 'treatmentComplete' | 'discharge'
    readonly payload: EventPayload; // discriminated on kind; carries ids, not object refs
  }
  ```
  Comparator: `(a, b) => a.time - b.time || a.seq - b.seq`. **The `seq`
  tiebreaker is non-negotiable for determinism** — when two events share a
  timestamp, FIFO insertion order must decide, or heap-internal ordering leaks
  non-determinism into outcomes.

- **Events carry ids, not object references.** Handlers resolve
  `patientId → Patient` against `WorldState` at execution time. This keeps the
  queue serializable and avoids stale-reference bugs.

- **No arbitrary event removal.** A binary heap cannot cheaply remove an
  arbitrary queued event. We do not try. Instead handlers are
  **idempotent / self-cancelling**: each re-reads current state and no-ops if the
  event is stale (e.g. a `treatmentComplete` fires for a patient already
  `Cancelled` → the handler does nothing and emits nothing). This is the standard
  DES event-invalidation pattern, simpler and less bug-prone than decrease-key.

- **The engine has no wall-clock and no async.** It exposes synchronous
  advancement primitives only:
  - `step(): boolean` — advance exactly one event; returns `false` if the queue
    is empty. Advances `simTime` to that event's time (monotonic — asserts it
    never goes backwards).
  - `runUntil(t: number): number` — process **all** events with `time <= t`,
    then leave `simTime === t` (even if no event landed exactly on `t`). Returns
    the count processed. **This is the browser host's workhorse.**
  - `run(maxEvents?: number): number` — headless driver for tests and empirical
    score tuning; runs to quiescence or an event cap, no wall-clock.
  - `runUntil` carries a safety max-iteration guard that **throws** on a
    pathological burst of same-timestamp events (a regression signal, tested
    deliberately).

- **The two-clock split (spec §6) lives in the host, not the engine.** The
  browser host runs a `requestAnimationFrame`/interval loop that maps
  `wall-clock delta × speedMultiplier` into a simTime budget, then calls
  `runUntil(simTime + budget)`. **Pause** = the host stops pumping. **Variable
  speed** = the host scales the budget. The engine never sleeps and never holds a
  timer — it is a synchronous state machine the host pumps.

---

## 5. Determinism and seeding

Determinism — *identical output given (config + seed)* — is the single property
that makes 100% coverage of stochastic code tractable and makes the save/replay
story possible.

- **Injectable RNG:**
  ```ts
  interface Rng {
    next(): number;            // float in [0, 1)
    int(maxExclusive: number): number;
    fork(label: string): Rng;  // derive a labelled, independent sub-stream
    getState(): number;        // current uint32 state
    setState(s: number): void;
  }
  ```
  Default implementation is **mulberry32** (single uint32 state, ~5 lines,
  zero-dep, seedable). `Math.random()` is **banned** — it is not seedable and
  would destroy determinism. The RNG is a first-class constructor parameter so
  tests can inject a scripted stub.

- **The seed lives in `EngineConfig.seed`** and is the authoritative origin of
  all stochasticity.

- **Separate forked sub-streams per concern** (one for arrivals, one for outcome
  rolls), derived deterministically from the root seed + a label. Why: with a
  single shared stream, adding or removing one arrival would shift every
  subsequent outcome roll, making tests brittle and the model fragile. Forked
  streams keep concerns independent.

- **Engine ids are a deterministic seeded counter** (`util/id.ts`: `p-1`, `p-2`,
  …), never `crypto.randomUUID()`. The envelope UUIDs (`eventId`, `gameId`) in
  the business contract are generated in the **contract layer**, which is allowed
  to be non-deterministic because it produces an outbound audit record, not
  simulation state. This keeps the determinism boundary clean.

---

## 6. State model

### 6.1 Patient state machine

```ts
enum PatientState {
  WaitingList, Scheduled, Admitted, InTreatment, ReadyForDischarge, Discharged, Cancelled,
}
```

`Discharged` and `Cancelled` are terminal. The HL7 ADT labels (A05, A01, A11,
A03) are attached as comments/metadata on transitions, never as runtime types —
the spec is explicit that HL7 is conceptual vocabulary, not a data format.

Transitions live in `model/transitions.ts` as **guarded pure functions** backed
by an explicit allowed-transition table:

```ts
const ALLOWED: Record<PatientState, PatientState[]> = { /* ... */ };
```

The table documents the legal graph and gives one place to assert that illegal
transitions throw — which also yields clean branch coverage on the guards.

```ts
interface Patient {
  id: string;
  state: PatientState;
  urgency: Urgency;
  durationClass: DurationClass;
  registeredAt: number;
  scheduledAt?: number;
  admittedAt?: number;
  treatmentStartedAt?: number;
  dischargedAt?: number;
  outcome?: OutcomeTier;       // 'good' | 'complication' | 'poor'
}
```

### 6.2 Resources

```ts
interface ResourceState {
  beds: { capacity: number; occupied: number };  // integer pool, occupied <= capacity
  doctors: { headcount: number };                 // headcount pool, NOT per-bed ratio
  nurses: { headcount: number };
}
```

The **staffing → throughput coupling** (spec §5) is a *pure function* in
`model/treatment.ts`, kept out of the resource struct:

```ts
function throughputMultiplier(doctors: number, nurses: number, cfg: StaffingConfig): number;
//   below either floor   -> 0     (hard floor: treatment STALLS)
//   at or above the floor -> 1 + cfg.softBonusPerExtra * (extra staff above minimum)
```

Treatment duration = `baseDuration / throughputMultiplier` (multiplier clamped).
Keeping this a pure function means the hard-floor and soft-bonus branches are
tested with plain inputs, no scheduler required.

**Stage 1 simplification (flagged):** the floor gates *starting* new treatments.
In-flight treatments are allowed to finish even if staff later drop below the
floor. The richer "freeze in-flight treatments and reschedule their completion on
every staff change" model is the most complex handler interaction in Stage 1 and
is **deferred** — it is not needed to prove the core loop.

### 6.3 Cancellation cause

The `no_bed_available` cause (spec §4/§11.4) falls straight out of the admit
handler: at A01, if `beds.occupied >= beds.capacity`, the patient transitions
`Scheduled → Cancelled` with `reason: 'no_bed_available'` instead of seizing a
bed.

### 6.4 How state is held

A single `WorldState` aggregate owned by `Simulation`:
`{ patients: Map<string, Patient>, resources: ResourceState, simTime, counters }`.
`Map` over array gives O(1) lookup by id from event payloads. It is mutated
**only** inside handlers, **only** during `step()`.

Rendering reads an immutable **`WorldStateReadModel`** — a cheap projection (a
fresh plain object per access; Svelte's reactivity prefers new references
anyway). If profiling later shows churn, memoize on a state-version counter.
This is a non-blocking note.

### 6.5 Arrival process

**Exponential inter-arrival times (a Poisson process)** sampled from the arrivals
RNG stream, with the rate as a config parameter. This is the standard DES choice
and delivers the "raise arrival rate → queue grows" dynamic the spec validates
against.

---

## 7. Two-tier events, save format, and cross-version replay

This is the heart of the design and the part with the most downstream
consequence.

### 7.1 Tier 1 — domain events (`packages/engine`)

A rich discriminated union, one variant per fine-grained happening, **finer than
the business contract** (e.g. `BedSeized`, `OutcomeRolled`, and `BedReleased` are
distinct events). Every event carries `simTime`. These are an implementation
detail (spec §8.1), free to change as the engine evolves.

```ts
type DomainEvent =
  | { kind: 'GameStarted';        simTime: number; config: EngineConfigSummary }
  | { kind: 'PatientRegistered';  simTime: number; patientId: string; urgency: Urgency; durationClass: DurationClass }
  | { kind: 'PatientScheduled';   simTime: number; patientId: string; scheduledFor: number }
  | { kind: 'BedSeized';          simTime: number; patientId: string; bedsFree: number }
  | { kind: 'PatientAdmitted';    simTime: number; patientId: string }
  | { kind: 'AdmissionCancelled'; simTime: number; patientId: string; reason: 'no_bed_available' }
  | { kind: 'TreatmentStarted';   simTime: number; patientId: string; expectedDuration: number }
  | { kind: 'OutcomeRolled';      simTime: number; patientId: string; outcome: OutcomeTier }
  | { kind: 'BedReleased';        simTime: number; patientId: string; bedsFree: number }
  | { kind: 'PatientDischarged';  simTime: number; patientId: string; outcome: OutcomeTier; lengthOfStay: number }
  | { kind: 'StaffChanged';       simTime: number; role: 'doctor' | 'nurse'; count: number };
```

The host subscribes via `simulation.subscribe(fn)` — synchronous fan-out
(emitted within `step()` before it returns, so consumers see ordering that
matches event causality), returning an unsubscribe function.

### 7.2 Tier 2 — business events (`packages/contract`)

The versioned, published contract. A `SCHEMA_VERSION` constant plus the envelope
from spec §8.3:

```ts
const SCHEMA_VERSION = '1.0.0';  // lives HERE, never in the engine

interface BusinessEventEnvelope<T extends BusinessEventType = BusinessEventType> {
  schemaVersion: string;   // SCHEMA_VERSION
  eventId: string;         // uuid — generated here
  gameId: string;          // uuid — generated here, stable per game
  simTime: number;         // integer ms, copied from the domain event
  wallTime: string;        // ISO-8601 real time at emission (non-deterministic, fine)
  type: BusinessEventType; // 'PatientAdmitted' | ...
  payload: BusinessPayloadFor<T>;
}
```

A **translator** subscribes to the domain stream and selects/shapes the coarse,
outside-world-relevant subset. It keeps its own derived state for accumulated
events such as `BudgetUpdated` (running totals) — *the engine never knows budget
exists*. Crucially the translator sees **only the engine's public domain-event
union**, which proves the spec §8.1 boundary holds.

A `BusinessEventSink` interface has two Stage 1 implementations: `ConsoleSink`
and `InMemorySink` (the test seam and the save source). The HTTP sink is a
switched-off stub. The contract types carry a prominent
**"DO NOT BREAK WITHOUT A VERSION BUMP"** header.

**The contract is the cross-language boundary.** Later stages consume this stream
from a Go or C# backend, so the *schema* is not expressed as hand-written
TypeScript. It is authored in **TypeSpec**, kept in
`app/packages/contract/schema/` for now (keeping the root clean; no premature
top-level `proto/`), with the TypeScript types **emitted** from it in Stage 1.
TypeSpec is chosen because it is a concise, purpose-built API/data IDL that can
emit JSON Schema, OpenAPI, and Protobuf — so the *wire-format* decision (spec
§8.3) stays open while the *source of truth* is fixed now. When the backend
arrives, the same TypeSpec is promoted to a shared top-level location and emits Go
structs or C# records (directly or via its Protobuf/JSON-Schema output), so every
language shares one definition and the `schemaVersion` means the same thing
everywhere. Stage 1 only needs the TypeSpec plus the TS emitter wired up; no
backend yet.

### 7.3 Save format and upgrading the engine while keeping saved games

This is the decisive requirement: **the engine version must be upgradable while
previously saved games remain playable.** Achieving it requires separating two
distinct concerns.

**1. Reconstructing PAST state — engine-version-independent.**
Business events **record their outcomes explicitly** (a discharge carries the
rolled tier; a cancellation carries its reason). Past state is therefore
reconstructed by *folding the recorded event log* — never by re-rolling the RNG.
Because nothing is recomputed, this survives any engine change.

**2. Continuing the game FORWARD after load — needs the engine to take over.**

Therefore the **save file is owned and versioned by `packages/contract`**, not by
the engine, and contains:

- the ordered business-event log (the audit/contract stream), and
- a **portable world-state snapshot** expressed in *contract terms* — patient
  states, resource counts, simTime, score — and explicitly **not** engine
  internals (no heap contents, no raw RNG `uint32`).

**Loading** is handled by an engine entry point
`createSimulationFromSnapshot(portableState, newSeed)`, which:

1. rebuilds `WorldState` from the portable snapshot, then
2. **re-derives the pending future events** from patient states — a patient
   `InTreatment` with `treatmentStartedAt + expectedDuration` gets its
   `treatmentComplete` rescheduled; the waiting list gets the next arrival
   scheduled — then
3. continues forward with a **freshly seeded RNG**.

**Explicit non-goal: bit-identical future reproduction across engine versions.**
Raw RNG-stream snapshots are retained *only* as a same-version optimisation;
across an upgrade we reseed, because a newer engine may consume randomness
differently (different number or order of draws). What is *guaranteed* is:

- exact reconstruction of recorded history (from the folded log), and
- a *valid continuation* of a saved game on a newer engine.

Cross-version compatibility is handled by **save-schema migration functions** in
`packages/contract` (`migrate(vN → vN+1)`), versioned by the save schema and
decoupled from engine internals.

This is precisely why the contract is its own package: it is the durable,
versioned boundary that must outlive any single engine version.

---

## 8. `app/web` — UI architecture

- **SvelteKit (Svelte 5 runes)**, Tailwind CSS, `lucide-svelte`, TypeScript in
  strict mode. `web` is **thin presentation glue** — the simulation-driving
  and scoring logic live in `packages/host` and `packages/scoring`, not here.
- `packages/host` owns the framework-agnostic driver: the wall→sim time mapping,
  pause/speed state, and the `runUntil` budgeting. `web` wires it to a
  `requestAnimationFrame` loop and pushes the resulting `WorldStateReadModel` into
  runes-based reactive state. (Keeping the timing arithmetic out of Svelte is what
  lets it be unit-tested to 100%.)
- The UI subscribes to **domain events** for incidental affordances and wires the
  **contract translator** to the (locally emitted) business stream.
- Minimal legible UI per spec §12: the waiting list, beds filling and emptying,
  queue length, the clock, the NHS score readout, bed/staff dials, and
  pause/speed controls. It surfaces the existing dynamics; it adds none.
- **Scoring (`packages/scoring`) is a pure read layer over engine state** — the
  engine stays ignorant of it. Payment is per discharge only, with no credit for
  cancellations (spec §9); the score blends throughput against three-tier outcome
  quality. As its own package it is reusable headless (score tuning) and,
  eventually, server-side, and is held to 100% coverage.

---

## 9. Testing and coverage strategy

Coverage is a **hard CI gate**: the pure TS packages — `engine`, `contract`,
`scoring`, and `host` — at **100% line + branch**, and `web` at **~80%**
(it is thin presentation glue; the logic worth covering was extracted into the
packages above). Determinism does the heavy lifting that makes 100% on stochastic
code achievable.

**Engine — three layers:**

- *Pure unit tests* (where branch coverage is won cheaply):
  - `heap` — push/pop ordering, `seq` tiebreak, empty-pop, heapify edges.
  - `rng` — fixed seed produces a known golden sequence; `fork` independence;
    `getState`/`setState` round-trip.
  - `treatment` — `throughputMultiplier` across below-doctor-floor,
    below-nurse-floor, exactly-at-floor, and above-floor; the three-tier outcome
    roll driven by a scripted `Rng` returning floats that land deterministically
    in each tier *and* on the boundaries.
  - `transitions` — every legal transition succeeds; a sample of illegal
    transitions throws.
- *Handler tests* — each handler with a hand-built `WorldState`, a scripted
  `Rng`, and a spy emitter; assert state mutations, the emitted events and their
  order, and the **stale-event no-op branch** (easy to forget, and a coverage gap
  if untested).
- *Acceptance scenarios* (`*.scenario.test.ts`, fixed seed, driven headless via
  `run`/`runUntil`):
  - arrival rate → queue grows;
  - ample capacity relieves the queue;
  - understaffing stalls treatment (zero discharges, patients pile up);
  - bed pressure → `AdmissionCancelled` with `no_bed_available`;
  - **determinism** — two simulations with the same config + seed produce
    deep-equal domain-event streams (the regression net for the whole
    determinism story);
  - outcome distribution over many treatments is within tolerance of the
    configured weights.

**Contract (100%):** the translator mapping for each domain event; envelope shape
and version; that the generated TS types match the IDL; save round-trip
(snapshot → mutate → reload → equal); a `migrate(vN → vN+1)` case; and
replay-from-log reconstructing recorded history exactly.

**Scoring (100%):** payment per discharge and zero credit for cancellations;
the three-tier outcome weighting; score derived purely from a given
`WorldStateReadModel` (no engine instance needed).

**Host (100%):** the wall→sim time mapping across speed multipliers; pause/resume
state; that `runUntil` is called with the correct budget and never with a
backwards target. Pure arithmetic, no DOM.

**UI (~80%):** Vitest component tests for the dials and readouts, plus
**Playwright e2e**: start a game, observe beds fill and the queue grow, exercise
pause/resume and speed change, and confirm the score updates.

**CI** (`.github/workflows/ci.yml`): install → lint → typecheck →
`vitest run --coverage` with per-package thresholds (the job fails below them) →
Playwright e2e. Thresholds are configured in `vitest.workspace.ts`.

---

## 10. Build order (refines spec §12)

1. **Repo skeleton** — a minimal root (`README.md`, `.gitattributes`,
   `.editorconfig`, `.github/`), then the self-contained `app/` workspace:
   `package.json` (workspaces + Node pin), `tsconfig.base.json`, the vitest
   workspace and coverage gate, `playwright.config.ts`, CI, and the import-boundary
   lint rule. No `services/`, no top-level IDL, no cross-language task runner yet —
   those land with the backend. The coverage gate must exist *before* code so the
   spec's "find and fix coverage gaps" discipline is enforced from the first commit.
2. **`packages/engine` — core + domain events together** — heap, rng, clock,
   scheduler, state, model, handlers, and event emission, built as one step
   (retrofitting an event stream is painful; building it in is nearly free).
   Validated headless with fixed-seed scenario tests.
3. **`packages/contract`** — language-neutral schema + generated TS types,
   translator, envelope, sinks, save format, and the migration scaffold; held to
   100% coverage; emitting locally only.
4. **`packages/scoring` + `packages/host`** — the pure NHS scoring read-layer and
   the framework-agnostic sim driver; both headless-testable to 100%.
5. **`web`** — thin Svelte glue wiring host + scoring + the minimal legible
   UI; covered by Playwright e2e.
6. **Wire together and tune** — settle the score formula empirically from headless
   runs.

---

## 11. Open items deliberately left for play or later

- The exact `softBonusPerExtra` curve and the staffing floors — a balance
  question, settled by play.
- Arrival rate, urgency mix, and duration-class distribution — config, tuned by
  play.
- The contract *wire format* (JSON Schema vs OpenAPI vs Protobuf) — deferred to
  when the feed is wired (spec §8.3). The schema *source of truth* is fixed now:
  **TypeSpec**, emitting TS in Stage 1 and any of those formats later (§7.2).
- Backend language (Go vs C#) for the eventual event-hub server — not chosen in
  Stage 1. The `services/` subtree, the root task runner, and the promoted
  top-level contract IDL are all introduced in the commit that adds the backend,
  not before — keeping the Stage 1 root clean (§2).
- Snapshot cadence for long sessions — not needed in Stage 1, but the save format
  supports periodic snapshots when it is.
