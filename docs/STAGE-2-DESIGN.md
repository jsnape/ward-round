# Stage 2 Technical Design — Engagement Overhaul

**Status:** Draft v0.1 — companion to [STAGE-2-SPEC.md](STAGE-2-SPEC.md) v0.1.
Architecture for review before code is written.

---

## 1. Purpose and relationship to the spec

This document implements [STAGE-2-SPEC.md](STAGE-2-SPEC.md). The spec owns *what*
and *why*; this design owns *how*. Where the spec resolved a design question (acuity
on capacity not occupied; no throughput multiplier; daily costs in scoring), this
document takes it as settled.

The Stage 1 architectural principle is unchanged and load-bearing:

> **The simulation engine is a neutral machine that moves patients through resources
> and rolls outcomes. Money, scoring, the business-event contract, and the UI are
> layers that read from and write to that machine — never tangled into it.**

All changes in Stage 2 honour this boundary. The engine gains a new config block
(`ward.acuity`) and a new `staffing.ts` module, but it remains ignorant of money,
scoring, and the UI.

---

## 2. Staffing model overhaul

This is the pre-condition for every other Stage 2 change and must land first.

### 2.1 What is removed

`StaffingConfig` (`minDoctors`, `minNurses`, `softBonusPerExtra`) is deleted from
`packages/engine/src/config/types.ts` and `defaults.ts`. The `throughputMultiplier`
function in `model/treatment.ts` is deleted. Every reference to these in handlers
and tests is replaced.

### 2.2 New config block

```ts
// packages/engine/src/config/types.ts
interface WardConfig {
  acuity: number; // nurses-per-bed ratio (e.g. 0.5 for general medicine)
}
```

`EngineConfig` gains `ward: WardConfig`. Default in `defaults.ts`: `ward: { acuity: 0.5 }`.

### 2.3 New `model/staffing.ts` — pure functions

All resource-availability logic lives in a single file:

```ts
/** Nurses permanently consumed by ward coverage duties. */
export function wardNursesNeeded(bedCapacity: number, acuity: number): number {
  return Math.ceil(bedCapacity * acuity);
}

/** Doctors and nurses free to take on a new procedure. */
export function freeStaff(
  resources: ResourceState,
  inTreatmentCount: number,
  acuity: number,
): { freeDoctors: number; freeNurses: number } {
  const wardNurses = wardNursesNeeded(resources.beds.capacity, acuity);
  return {
    freeDoctors: resources.doctors - inTreatmentCount,
    freeNurses: Math.max(0, resources.nurses - wardNurses - inTreatmentCount),
  };
}

/** True if a new treatment can start right now. */
export function canStartTreatment(freeDoctors: number, freeNurses: number): boolean {
  return freeDoctors >= 1 && freeNurses >= 1;
}

/** True if adding one more bed is covered by current nurse headcount. */
export function canAddBed(
  currentCapacity: number,
  nurses: number,
  acuity: number,
): boolean {
  return nurses >= wardNursesNeeded(currentCapacity + 1, acuity);
}
```

`inTreatmentCount` is always computed from world state, never stored:
`[...state.patients.values()].filter(p => p.state === PatientState.InTreatment).length`.

### 2.4 Admission handler changes

`packages/engine/src/handlers/admission.ts` replaces the `isStaffed(...)` /
`throughputMultiplier(...)` call with `canStartTreatment(freeStaff(...))`.

Treatment duration changes from `baseDuration / multiplier` to
`getProcedure(patient.procedureId).baseDurationMs` directly (the multiplier is gone).
This means `admission.ts` will need `§1 (procedures)` to land before it compiles; the
staffing overhaul commit keeps patients using `durationClass` temporarily, or the two
changes land in a single commit — see build sequence (§9).

### 2.5 Exports

`staffing.ts` functions are exported from `packages/engine/src/index.ts`.
`canAddBed` is also used by the scoring `bottleneck.ts` module (§7) and by the UI
game controller `game.ts` (§8.3), both of which may import it from the engine barrel.

---

## 3. Procedure catalog (`packages/engine/src/config/procedures.ts`)

New file, exported from the engine barrel.

```ts
export type SpecialtyId = "general_medicine"; // union grows in Stage 3+

export type ProcedureId =
  | "appendectomy" | "hernia_repair" | "cataract_surgery" | "colonoscopy"
  | "cholecystectomy" | "tonsillectomy" | "knee_arthroscopy" | "cardiac_stent"
  | "hip_replacement" | "lumbar_fusion";

export interface ProcedureDef {
  readonly id: ProcedureId;
  readonly displayName: string;
  readonly baseDurationMs: number;
  readonly complexity: "minor" | "major";
  readonly requiredSpecialty: SpecialtyId;
  readonly urgencyEligibility: readonly Urgency[];
  readonly weight: number; // relative arrival weight
}

export const PROCEDURE_CATALOG: readonly ProcedureDef[] = [ /* 10 entries */ ];
export const PROCEDURE_IDS: readonly ProcedureId[] = PROCEDURE_CATALOG.map(p => p.id);

export function getProcedure(id: ProcedureId): ProcedureDef {
  const found = PROCEDURE_CATALOG.find(p => p.id === id);
  if (!found) throw new RangeError(`Unknown procedure: ${id}`);
  return found;
}
```

The 10 entries match the table in STAGE-2-SPEC.md §4.

### 3.1 Engine cascade for `procedureId`

**`state/patient.ts`**
- Remove `DurationClass` type, `DURATION_CLASSES` constant
- Replace `durationClass: DurationClass` with `procedureId: ProcedureId` on `Patient`
- Update `createPatient` argument signature to match

**`config/types.ts`**
- Remove `DurationConfig` / `baseDurationMs: Record<DurationClass, number>`
- Remove `durationClassWeights: Record<DurationClass, number>` from `ArrivalConfig`
- `ArrivalConfig` optionally gains `procedureWeightOverrides?: Partial<Record<ProcedureId, number>>`
  for per-game tuning (resolved by merging with catalog weights at draw time)

**`config/defaults.ts`**
- Remove `baseDurationMs` block and `durationClassWeights`

**`model/arrivals.ts`**
- Remove `drawDurationClass`
- Add `drawProcedure(cfg: ArrivalConfig, urgency: Urgency, rng: Rng): ProcedureId`:
  filters `PROCEDURE_CATALOG` to entries whose `urgencyEligibility` includes
  `urgency`, then calls `weightedPick` on the filtered set's weights (merged with any
  `procedureWeightOverrides`)

**`model/treatment.ts`**
- Remove `throughputMultiplier`, `isStaffed`
- `treatmentDuration(procedureId: ProcedureId): number` returns
  `getProcedure(procedureId).baseDurationMs`
- Add `procedureOutcomeWeights(procedureId: ProcedureId, base: OutcomeWeights): OutcomeWeights`:
  for minor-complexity procedures, subtract 0.05 from `complication`, add 0.05 to
  `good`; leave `poor` unchanged; return a new object (never mutate)

**`domain/events.ts`**
- `PatientRegistered`: replace `durationClass: DurationClass` with `procedureId: ProcedureId`
- `TreatmentStarted`: add `procedureId: ProcedureId`

**Handlers**
- `arrivalHandler.ts`: call `drawProcedure` instead of `drawDurationClass`; pass
  `procedureId` to `createPatient`; include in `PatientRegistered` emission
- `admission.ts` (also changes for staffing): `treatmentDuration` call uses
  `procedureId`; `TreatmentStarted` includes `procedureId`
- `treatmentHandler.ts`: `rollOutcome` call uses
  `procedureOutcomeWeights(patient.procedureId, config.outcomeWeights)`

---

## 4. Contract changes (`packages/contract`)

### 4.1 TypeSpec schema (`schema/main.tsp`)

- Remove `enum DurationClass`
- Add `enum ProcedureId` with all 10 values
- `PatientRegisteredPayload`: replace `durationClass: DurationClass` with
  `procedureId: ProcedureId`
- `TreatmentStartedPayload`: add `procedureId: ProcedureId`
- `BudgetUpdatedPayload`: add `staffCostToDate: safeint`
- Run `npm run gen` to regenerate `generated/businessEvents.ts`

### 4.2 Translator (`src/translator.ts`)

- `PatientRegistered` mapping: emit `procedureId` instead of `durationClass`
- `TreatmentStarted` mapping: include `procedureId`
- Add `case "StaffChanged"` to update tracked headcount (currently falls through to
  `default` / no-op); translator internal state gains `currentDoctors` and
  `currentNurses` initialised from `GameStarted`
- `BudgetUpdated` emission on `PatientDischarged` now adds salary contribution:
  `staffCostToDate = event.simTime / MS_PER_DAY * (currentDoctors * dailyDoctorCost + currentNurses * dailyNurseCost + currentBeds * dailyBedCost)`
- `TranslatorConfig` gains `dailyDoctorCost`, `dailyNurseCost`, `dailyBedCost`

---

## 5. Scoring changes (`packages/scoring`)

### 5.1 Updated `score.ts`

`ScoringConfig` gains:
```ts
dailyDoctorCost: number;  // default 500
dailyNurseCost: number;   // default 200
dailyBedCost: number;     // default 50
```

`DEFAULT_SCORING_CONFIG`:
```ts
budget: 60_000,
paymentPerDischarge: 2_500,
dailyDoctorCost: 500,
dailyNurseCost: 200,
dailyBedCost: 50,
```

`scoreState(state, config)` now computes:
```ts
const simDays = state.simTime / MS_PER_DAY;
const staffCostToDate =
  simDays * (
    state.doctors * config.dailyDoctorCost +
    state.nurses  * config.dailyNurseCost  +
    state.beds.capacity * config.dailyBedCost
  );
const spent   = state.counters.discharged * config.paymentPerDischarge + staffCostToDate;
const remaining = config.budget - spent;
```

`Score` gains `staffCostToDate: number`.

### 5.2 New `bottleneck.ts`

```ts
import { freeStaff, wardNursesNeeded } from "@ward-round/engine";

export type BottleneckKind = "beds" | "doctors" | "nurses" | "balanced";

export interface BottleneckAnalysis {
  kind: BottleneckKind;
  bedUtilisation: number;
  freeDoctors: number;
  freeNurses: number;
  wardNursesConsumed: number;
  stalledPatients: number; // Admitted state, treatment not yet started
}

export function analyseBottleneck(
  state: WorldStateReadModel,
  acuity: number,
): BottleneckAnalysis
```

Decision logic (first match wins):
1. `stalledPatients > 0` and `freeDoctors < 1` → `"doctors"`
2. `stalledPatients > 0` and `freeNurses < 1` → `"nurses"`
3. `bedUtilisation >= 0.9` and `state.waitingListLength > 0` → `"beds"`
4. `freeDoctors === 0` → `"doctors"`
5. `freeNurses === 0` → `"nurses"`
6. otherwise → `"balanced"`

### 5.3 New `throughput.ts`

```ts
export function computeThroughputRate(
  discharged: number,
  simTime: number,
): number // discharges per sim-day; 0 when simTime === 0
```

### 5.4 Updated `index.ts`

Re-exports `analyseBottleneck`, `BottleneckAnalysis`, `BottleneckKind`,
`computeThroughputRate` alongside existing exports.

---

## 6. Host changes (`packages/host/src/driver.ts`)

```ts
// New: 1 real minute = 1 sim day
export const DEFAULT_SIM_MS_PER_WALL_MS = (24 * 60 * 60 * 1000) / 60_000; // 1440

export const SPEED_PRESETS = [1, 4, 20, 60] as const;
// Corresponding UI labels: "Live" | "Daily" | "Weekly" | "Turbo"
```

No other driver logic changes. The `setSpeed` guard that rejects non-positive values
is unchanged; `SPEED_PRESETS` is re-exported for the UI to enumerate.

---

## 7. Engine state changes (`packages/engine/src/state/worldState.ts`)

`PatientView` gains four new optional fields:

```ts
procedureId: ProcedureId;         // replaces durationClass
treatmentStartedAt?: number;
expectedDischargeAt?: number;
admittedAt?: number;
```

`toView` projects these directly from the `Patient`. `toPortable` and `fromPortable`
copy all patient fields verbatim (as they do today); no save-format migration is
required because the old field name `durationClass` in portable saves would be
re-interpreted as `undefined` on load — a tolerable forward-compatibility gap for
in-development saves. If a formal migration is needed, add a `v1 → v2` migration in
`contract/src/save/migrate.ts`.

`WorldStateReadModel` also adds:
```ts
readonly inTreatmentCount: number; // derived; equals patients in InTreatment state
```

This avoids recomputing the filter in multiple callers.

---

## 8. Web app changes

### 8.1 New format helpers (`web/src/lib/format.ts`)

```ts
export function formatWaitDays(registeredAt: number, simTime: number): string
// "3d 4h" — zero-safe (shows "0h" for fresh arrivals)

export function formatProgress(startAt: number, endAt: number, simTime: number): number
// 0–100 clamped; saturates at 100 when treatment overruns
```

Unit tests in `format.test.ts` (these are pure functions; 100% coverage required).

### 8.2 New Svelte components

All components are pure presenters: they receive already-computed values as props
and emit no events upward. Logic belongs in `game.ts` or format helpers.

**`InpatientCard.svelte`**
Props: `patient: PatientView`, `simTime: number`, `procedureName: string`
- Short patient ID ("P-7"), procedure name
- State badge (Admitted / In Treatment / Ready)
- Progress bar (0–100%) when `treatmentStartedAt` is set
- Outcome badge (green "Good" / amber "Complication" / red "Poor") when `outcome` is set

**`WaitingPatientRow.svelte`**
Props: `patient: PatientView`, `simTime: number`, `procedureName: string`
- Urgency chip (red / amber / slate)
- Short patient ID, procedure name
- Wait duration from `formatWaitDays`

**`BottleneckBadge.svelte`**
Props: `bottleneck: BottleneckAnalysis`
- `"balanced"` → green "Balanced"
- `"beds"` → red "Bed shortage" with pulse ring
- `"doctors"` → amber "Doctor shortage" with pulse ring
- `"nurses"` → amber "Nurse shortage" with pulse ring

### 8.3 Updated `game.ts`

`GameSnapshot` gains:
```ts
bottleneck: BottleneckAnalysis;
throughputPerDay: number;
canAddBed: boolean;
nurseSplit: { ward: number; procedures: number; free: number };
```

`snapshot()` calls `analyseBottleneck(state, config.ward.acuity)`,
`computeThroughputRate(score.patientsTreated, state.simTime)`, and
`canAddBed(state.beds.capacity, state.nurses, config.ward.acuity)`.

`Game` gains a reference to `config.ward.acuity` (already held in the engine config;
no new constructor param).

### 8.4 Updated `+page.svelte`

- Beds section: replace the dot-grid with a scrollable list. Occupied beds render
  `InpatientCard`; free beds render a placeholder row. Sorted by `admittedAt`.
  Bed + button is `disabled` and shows a tooltip when `!snapshot.canAddBed`.
- Waiting list section: render up to 10 `WaitingPatientRow` for waiting patients,
  followed by a "+N more" count. Previous count-only display is replaced.
- Resource panel header: add `BottleneckBadge` prominently.
- Nurse dial section: show `nurseSplit` as "X ward / Y procedures / Z free".
- Add throughput line: "X.X discharges/day" below the Treated counter.
- Speed preset buttons relabelled: "Live" (1×) | "Daily" (4×) | "Weekly" (20×) |
  "Turbo" (60×). `data-testid` attributes use `speed-1`, `speed-4`, `speed-20`,
  `speed-60` for Playwright.
- Add "Queue growing" / "Queue stable" indicator in the waiting list header: compare
  `snapshot.waitingListLength` with the previous frame's value in Svelte state.

---

## 9. Build sequence

The sections have dependency ordering. All changes in a single commit must compile
and pass tests before the next commit starts.

```
commit 1: Staffing overhaul
  - packages/engine/src/config/types.ts — remove StaffingConfig, add WardConfig
  - packages/engine/src/config/defaults.ts — remove staffing, add ward
  - packages/engine/src/model/staffing.ts (new)
  - packages/engine/src/model/treatment.ts — remove throughputMultiplier, isStaffed
  - packages/engine/src/index.ts — re-export staffing functions
  - All handler + scenario tests updated (durationClass still in place)

commit 2: Procedure catalog + patient type (§1 engine)
  - packages/engine/src/config/procedures.ts (new)
  - packages/engine/src/state/patient.ts — durationClass → procedureId
  - packages/engine/src/config/types.ts — remove DurationConfig
  - packages/engine/src/config/defaults.ts — remove baseDurationMs
  - packages/engine/src/model/arrivals.ts — drawProcedure
  - packages/engine/src/model/treatment.ts — treatmentDuration, procedureOutcomeWeights
  - packages/engine/src/domain/events.ts — procedureId in events
  - All handlers updated
  - All test helpers updated

commit 3: Contract schema + translator (§1 contract)
  - packages/contract/schema/main.tsp
  - npm run gen
  - packages/contract/src/translator.ts

commit 4: Speed changes (§4)
  - packages/host/src/driver.ts
  - packages/host/src/driver.test.ts
  - app/web/e2e/ward.spec.ts

commit 5: Scoring salary model (§2)
  - packages/scoring/src/score.ts
  - packages/contract/src/translator.ts (StaffChanged + salary contribution)
  - packages/contract/schema/main.tsp (BudgetUpdatedPayload.staffCostToDate)
  - npm run gen

commit 6: Default rebalancing + new scenario tests (§3)
  - packages/engine/src/config/defaults.ts
  - packages/scoring/src/score.ts (DEFAULT_SCORING_CONFIG)
  - packages/engine/src/scenarios/lifecycle.scenario.test.ts

commit 7: Patient visibility (§5)
  - packages/engine/src/state/worldState.ts (PatientView extensions)
  - app/web/src/lib/format.ts
  - app/web/src/lib/format.test.ts
  - app/web/src/lib/InpatientCard.svelte (new)
  - app/web/src/lib/WaitingPatientRow.svelte (new)
  - app/web/src/routes/+page.svelte (bed list, waiting list)
  - app/web/src/lib/game.ts (GameSnapshot extension)

commit 8: Resource constraint visualization (§6)
  - packages/scoring/src/bottleneck.ts (new)
  - packages/scoring/src/bottleneck.test.ts (new)
  - packages/scoring/src/throughput.ts (new)
  - packages/scoring/src/throughput.test.ts (new)
  - packages/scoring/src/index.ts (re-exports)
  - app/web/src/lib/BottleneckBadge.svelte (new)
  - app/web/src/lib/game.ts (bottleneck + throughput in snapshot)
  - app/web/src/routes/+page.svelte (badge, nurse split, throughput, queue indicator)
```

---

## 10. Testing and coverage strategy

The Stage 1 coverage discipline is unchanged:
- `engine`, `contract`, `scoring`, `host`: **100% line + branch**
- `web`: **~80%**
- No `istanbul ignore` escapes without review justification

**New files requiring 100% coverage:**
- `model/staffing.ts` — `staffing.test.ts`: all four functions at all boundary conditions
- `config/procedures.ts` — `procedures.test.ts`: `it.each` over all 10 ids; `getProcedure` throw path; `urgencyEligibility` spot-check per urgency tier
- `scoring/bottleneck.ts` — `bottleneck.test.ts`: one describe block per decision branch
- `scoring/throughput.ts` — `throughput.test.ts`: zero simTime, non-zero, large values
- `web/src/lib/format.ts` — `format.test.ts`: zero wait, multi-day wait, progress 0/50/100/>100

**Updated coverage requirements:**
- `model/arrivals.ts` — `drawProcedure` property test: 1000 draws with `urgency = "routine"` → no result in `["appendectomy", "cardiac_stent"]` (emergency-only procedures)
- `model/treatment.ts` — `procedureOutcomeWeights` tests for minor (shifts) and major (unchanged)
- `domain/events.ts` — `isDomainEvent` type guard tests unchanged; new field presence verified in translator tests
- All handler test helpers that call `createPatient` gain `procedureId: "appendectomy"` as a default

**New scenario tests (`scenarios/lifecycle.scenario.test.ts`):**
- "default config creates queue pressure within 20 sim-days" — assert `waitingListLength > 0` and `counters.cancelled > 0`
- "adding 1 doctor reduces waiting list vs baseline" — two runs, same seed, one with `doctors + 1`
- "canAddBed returns false at acuity floor" — assert `canAddBed(8, 4, 0.5) === false` (4 nurses needed for 8 beds; 4 < 5 needed for 9 beds)

**E2E updates (`ward.spec.ts`):**
- Replace `speed-5` → `speed-60` (Turbo) everywhere
- Add: bottleneck badge is visible on load
- Add: bed + button disabled tooltip when nurses insufficient (test with 0 nurses)
- Add: patient cards appear after patients are admitted at speed-60

---

## 11. Open items for play-tuning

- Procedure arrival weights (the relative frequency of each procedure) — starting
  values in the catalog; tune empirically after first playable.
- Outcome probability base values (good/complication/poor) — unchanged from Stage 1;
  minor-complexity shift of −0.05 complication is a starting guess.
- Daily cost values and starting budget — see defaults; final values are a balance
  question settled empirically.
- Bed acuity for general medicine — 0.5 is the starting value; tune by feel.
