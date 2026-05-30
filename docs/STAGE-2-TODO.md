# Stage 2 Implementation TODO

Working checklist for building Stage 2, derived from [STAGE-2-DESIGN.md](STAGE-2-DESIGN.md)
and [STAGE-2-SPEC.md](STAGE-2-SPEC.md).

**How to use this doc**

- Sections are ordered to be built in sequence; each builds on the last.
- Every section opens with **❓ Outstanding questions** (answer before starting),
  then a **Description**, then **Acceptance criteria**, then the **Tasks** checklist.
- Tick tasks as they land. Return any time; the next unchecked section is next.
- Questions marked **(blocking)** must be answered before the section can start;
  others have a sensible default in brackets.

**Progress overview**

- [x] §0 — Stage 2 documentation (spec, design, TODO)
- [ ] §0b — Staffing model overhaul (remove StaffingConfig; add ward.acuity + staffing.ts)
- [ ] §1 — Procedure catalog (replace durationClass with procedureId)
- [ ] §2 — Staffing costs (daily salary drain in scoring)
- [ ] §3 — Challenge rebalancing (new defaults + scenario tests)
- [ ] §4 — Simulation speed (new presets + labels)
- [ ] §5 — Patient visibility UI (inpatient cards, waiting list rows)
- [ ] §6 — Resource constraint visualization (bottleneck badge, nurse split)

---

## §0 — Stage 2 documentation

### ❓ Outstanding questions

- None.

### Description

Write the three Stage 2 reference documents (spec, design, TODO) before any code.
Update `CLAUDE.md` to reference them. These documents drive all subsequent sections
so they must exist and be reviewed before implementation starts.

### Acceptance criteria

- `docs/STAGE-2-SPEC.md`, `docs/STAGE-2-DESIGN.md`, `docs/STAGE-2-TODO.md` exist
  and match each other.
- `CLAUDE.md` links the new Stage 2 docs alongside Stage 1.
- A fresh session reading only `CLAUDE.md` understands that Stage 2 docs exist and
  where to find them.

### Tasks

- [x] Write `docs/STAGE-2-SPEC.md`.
- [x] Write `docs/STAGE-2-DESIGN.md`.
- [x] Write `docs/STAGE-2-TODO.md` (this file).
- [x] Update `CLAUDE.md` to reference the Stage 2 docs.

---

## §0b — Staffing model overhaul

### ❓ Outstanding questions

- None. All decisions resolved in the spec (§3.2) and design (§2).

### Description

Replace the `StaffingConfig` (minDoctors, minNurses, softBonusPerExtra) and
`throughputMultiplier` with the nurse-acuity + per-treatment-allocation model.

This must land before `§1` because `§1` removes `durationClass` from patients, and
the treatment logic must already use the new staffing model when that happens.

Doing this in two commits is cleaner: first, the staffing model changes (this
section); second, the procedure changes (§1). After this commit, patients still
carry `durationClass` but treatment gating uses `canStartTreatment`.

### Acceptance criteria

- `StaffingConfig` type and `staffing` key are gone from `EngineConfig`.
- `WardConfig` is defined and `ward.acuity` is in `EngineConfig`.
- `model/staffing.ts` exports `wardNursesNeeded`, `freeStaff`, `canStartTreatment`,
  `canAddBed`.
- `throughputMultiplier` and `isStaffed` are deleted from `treatment.ts`.
- Admission handler uses `canStartTreatment(freeStaff(...))`.
- All existing tests pass; engine package at **100% line + branch**.
- No reference to `StaffingConfig`, `minDoctors`, `minNurses`, or
  `softBonusPerExtra` remains in the codebase.

### Tasks

- [ ] `config/types.ts` — remove `StaffingConfig`; add `WardConfig`; update `EngineConfig`.
- [ ] `config/defaults.ts` — remove `staffing` block; add `ward: { acuity: 0.5 }`.
- [ ] `model/staffing.ts` (new) — four functions as per design §2.3.
- [ ] `model/treatment.ts` — remove `throughputMultiplier`, `isStaffed`; simplify
      `treatmentDuration` (duration still from `durationClass` lookup for now; will
      change in §1).
- [ ] `handlers/admission.ts` — replace `isStaffed`/`throughputMultiplier` call with
      `canStartTreatment(freeStaff(...))`.
- [ ] `index.ts` — re-export staffing functions.
- [ ] Unit tests `model/staffing.test.ts` (new):
  - `wardNursesNeeded`: exact boundary at 0.5 ratio, fractional ceil, zero beds.
  - `freeStaff`: zero in-treatment, in-treatment equals doctors, in-treatment
    exceeds nurses, all nurses consumed by ward coverage.
  - `canStartTreatment`: both true, doctor=0, nurse=0, both=0.
  - `canAddBed`: exactly at floor, one below, comfortably above.
- [ ] Update `model/treatment.test.ts` — remove `throughputMultiplier` tests; keep
      outcome and recovery tests.
- [ ] Update all handler test helpers that referenced `StaffingConfig`.
- [ ] Update scenario tests that relied on `minDoctors`/`minNurses` to stall treatment;
      replace with staff-count-below-in-treatment patterns.
- [ ] Engine at 100% coverage; lint/typecheck clean.

---

## §1 — Procedure catalog (replaces `durationClass`)

### ❓ Outstanding questions

- Procedure arrival weights: [default: equal weight = 1 for all 10; tune in §3].
- `procedureWeightOverrides` in `ArrivalConfig`: [include as optional field now so
  the config is extensible; no UI to set it in Stage 2].

### Description

Replace `durationClass: "short" | "medium" | "long"` with `procedureId: ProcedureId`
throughout the engine, contract, and UI. Patients arrive for named NHS procedures;
treatment duration and outcome risk derive from the procedure definition.

### Acceptance criteria

- `DurationClass`, `DURATION_CLASSES`, `durationClassWeights`, and `baseDurationMs`
  are gone.
- `ProcedureDef`, `ProcedureId`, `PROCEDURE_CATALOG`, `getProcedure`, `PROCEDURE_IDS`
  exist in `config/procedures.ts` and are exported from the barrel.
- `Patient.procedureId` replaces `Patient.durationClass`.
- `PatientRegistered` domain event carries `procedureId`.
- `TreatmentStarted` domain event carries `procedureId`.
- `drawProcedure` filters by urgency eligibility (no emergency colonoscopies).
- `procedureOutcomeWeights` shifts minor-procedure complication probability down 0.05.
- Contract TypeSpec schema updated; `npm run gen` produces updated TS types.
- Contract translator forwards `procedureId` in `PatientRegistered` and
  `TreatmentStarted` business events.
- **Engine and contract packages at 100% coverage**.

### Tasks

**Engine**
- [ ] `config/procedures.ts` (new) — catalog, types, `getProcedure`.
- [ ] `state/patient.ts` — remove `DurationClass`; add `procedureId: ProcedureId`.
- [ ] `config/types.ts` — remove `DurationConfig`; remove `durationClassWeights`
      from `ArrivalConfig`; add optional `procedureWeightOverrides`.
- [ ] `config/defaults.ts` — remove `baseDurationMs` block.
- [ ] `model/arrivals.ts` — remove `drawDurationClass`; add `drawProcedure`.
- [ ] `model/treatment.ts` — `treatmentDuration(procedureId)` uses catalog lookup;
      add `procedureOutcomeWeights`.
- [ ] `domain/events.ts` — `PatientRegistered` and `TreatmentStarted` carry `procedureId`.
- [ ] `handlers/arrivalHandler.ts` — call `drawProcedure`; emit `procedureId`.
- [ ] `handlers/admission.ts` — `treatmentDuration` from `procedureId`; emit in
      `TreatmentStarted`.
- [ ] `handlers/treatmentHandler.ts` — use `procedureOutcomeWeights`.

**Tests**
- [ ] `config/procedures.test.ts` (new):
  - `getProcedure` returns the correct entry for each id (use `it.each`).
  - `getProcedure` throws `RangeError` on an unknown id.
  - Every procedure has at least one urgency-eligible tier.
  - `urgencyEligibility` spot-check: `"cataract_surgery"` not eligible for emergency.
- [ ] `model/arrivals.test.ts` — property test: 1000 draws with `urgency = "emergency"`
      → only `appendectomy`, `cholecystectomy`, `cardiac_stent` returned.
- [ ] `model/treatment.test.ts` — `procedureOutcomeWeights` for minor (good up,
      complication down, poor unchanged) and major (all unchanged).
- [ ] All handler test helpers — add `procedureId: "appendectomy"` to default patient
      args; remove `durationClass`.
- [ ] Scenario tests — update any assertion on `durationClass` to `procedureId`.

**Contract**
- [ ] `schema/main.tsp` — remove `DurationClass`; add `ProcedureId` enum; update
      `PatientRegisteredPayload`; add `procedureId` to `TreatmentStartedPayload`.
- [ ] `npm run gen` — regenerate; verify CI `gen-check` step still passes.
- [ ] `translator.ts` — forward `procedureId` in both mappings.
- [ ] `translator.test.ts` — update `PatientRegistered` and `TreatmentStarted` tests.

---

## §2 — Staffing costs (daily salary drain)

### ❓ Outstanding questions

- `dailyBedCost` — is there a per-bed cost? [default: yes, £50/day; keeps beds
  from being free to open].
- Translator: should it track headcount via `StaffChanged` to emit `staffCostToDate`
  in `BudgetUpdated`? [default: yes — the translator already hears `StaffChanged`
  after §0b; it needs to accumulate salary for the business-event log].

### Description

Add ongoing salary costs to the scoring model. Budget is drained every sim-day by
the current headcounts of doctors, nurses, and open beds. The engine stays ignorant
of money; costs are a pure function of `WorldStateReadModel` in the scoring package.

### Acceptance criteria

- `ScoringConfig` has `dailyDoctorCost`, `dailyNurseCost`, `dailyBedCost`.
- `Score` has `staffCostToDate`.
- `scoreState` computes costs correctly from `simTime`.
- `BudgetUpdatedPayload` in the contract carries `staffCostToDate`.
- Translator tracks headcount and includes salary in `BudgetUpdated`.
- `DEFAULT_SCORING_CONFIG` uses the values from the spec (£500/£200/£50).
- **Scoring and contract packages at 100% coverage**.

### Tasks

**Scoring**
- [ ] `score.ts` — add salary config fields + `staffCostToDate` computation.
- [ ] `score.ts` — update `DEFAULT_SCORING_CONFIG`.
- [ ] `score.test.ts` — add:
  - salary accumulates over sim-days;
  - zero-headcount edge (no crash);
  - discharge + salary combined;
  - bed cost contribution;
  - `staffCostToDate` field is present on `Score`.

**Contract**
- [ ] `schema/main.tsp` — `BudgetUpdatedPayload` gains `staffCostToDate: safeint`.
- [ ] `npm run gen`.
- [ ] `translator.ts` — add `case "StaffChanged"` to update tracked headcount;
      update `BudgetUpdated` emission to include salary.
- [ ] `translator.ts` — `TranslatorConfig` gains `dailyDoctorCost`, `dailyNurseCost`,
      `dailyBedCost`.
- [ ] `translator.test.ts` — test `StaffChanged` headcount tracking; test
      `staffCostToDate` in emitted `BudgetUpdated`.

---

## §3 — Challenge rebalancing

### ❓ Outstanding questions

- Are starting defaults provisional (tune by play)? [default: yes — values
  documented in STAGE-2-SPEC.md §5.2 are starting points; update after first run].

### Description

Tighten the default configuration so the ward creates visible queue pressure within
20 sim-days at default settings. Add scenario tests that enforce the balance and
act as regression guards.

### Acceptance criteria

- Default engine config matches the Stage 2 table in design §9 (8 beds, 3 doctors,
  6 nurses, 0.8d arrival rate, etc.).
- Default scoring config matches (£60k budget, £2,500/discharge, cost rates).
- New scenario: "default config creates pressure within 20 sim-days" passes.
- New scenario: "+1 doctor reduces waiting list vs baseline" passes.
- `canAddBed(8, 4, 0.5)` test assertion confirms the floor is enforced.
- Engine at **100% coverage**.

### Tasks

- [ ] `config/defaults.ts` — update resource counts, arrival rate, bed-manager config.
- [ ] `scoring/score.ts` — update `DEFAULT_SCORING_CONFIG` (budget, payment, costs).
- [ ] `scenarios/lifecycle.scenario.test.ts`:
  - "default config creates queue pressure within 20 sim-days"
  - "adding 1 doctor measurably reduces waiting list vs baseline" (two fixed-seed runs)
  - "canAddBed returns false at acuity floor" (pure assertion, no sim required)
- [ ] Run `npm test` and tune values if the balance scenario fails; commit final numbers.

---

## §4 — Simulation speed

### ❓ Outstanding questions

- None. Speed preset values and labels are decided in the spec (§6).

### Description

Change the default simulation rate from 1 sim-day/real-second to 1 sim-day/real-minute.
Rename and revalue the speed presets to "Live", "Daily", "Weekly", "Turbo".

### Acceptance criteria

- `DEFAULT_SIM_MS_PER_WALL_MS` equals `(24 * 60 * 60 * 1000) / 60_000` (1440).
- `SPEED_PRESETS` is `[1, 4, 20, 60]`.
- Host package at **100% coverage**.
- E2E tests pass using `speed-60` (Turbo) to drive the sim forward quickly.

### Tasks

- [ ] `packages/host/src/driver.ts` — update constants.
- [ ] `packages/host/src/driver.test.ts` — update preset assertion and timing math.
- [ ] `app/web/e2e/ward.spec.ts` — replace all `speed-5` with `speed-60`.
- [ ] `app/web/src/routes/+page.svelte` — rename speed buttons ("Live" / "Daily" /
      "Weekly" / "Turbo") with correct `data-testid` values.
- [ ] `npm run test:e2e` — confirm all e2e tests pass.

---

## §5 — Patient visibility UI

### ❓ Outstanding questions

- Maximum waiting list rows shown: [default: 10, with "+N more" count].
- Patient name display: [default: short ID only, "P-7"; no generated names in Stage 2].

### Description

Show individual patients with their procedure, progress, and outcome. Replace the
dot-grid bed display with per-patient cards. Expand the waiting list from a count
to a scrollable list of waiting patients.

### Acceptance criteria

- Admitted/InTreatment/ReadyForDischarge patients are listed individually with
  procedure name, state badge, and treatment progress (where applicable).
- Waiting list shows up to 10 patients with urgency, procedure, and wait duration.
- `PatientView` carries `procedureId`, `treatmentStartedAt`, `expectedDischargeAt`,
  `admittedAt`.
- `formatWaitDays` and `formatProgress` are at **100% coverage** in `format.test.ts`.
- Bed + dial is disabled when `canAddBed` is false.
- Web package at **≥80% coverage**.

### Tasks

**Engine**
- [ ] `state/worldState.ts` — add `procedureId`, `treatmentStartedAt`,
      `expectedDischargeAt`, `admittedAt` to `PatientView`; update `toView`.
- [ ] `state/worldState.ts` — add `inTreatmentCount: number` to `WorldStateReadModel`.

**Web helpers**
- [ ] `web/src/lib/format.ts` — add `formatWaitDays`, `formatProgress`.
- [ ] `web/src/lib/format.test.ts` — full coverage: zero wait, multi-day, progress
      0/50/100/>100 (clamp).

**Svelte components**
- [ ] `web/src/lib/InpatientCard.svelte` — patient ID, procedure, state badge,
      progress bar, outcome badge.
- [ ] `web/src/lib/WaitingPatientRow.svelte` — urgency chip, patient ID, procedure,
      wait duration.

**Game controller**
- [ ] `web/src/lib/game.ts` — add `canAddBed` to `GameSnapshot`; import
      `canAddBed` from engine barrel.

**Page**
- [ ] `web/src/routes/+page.svelte` — replace dot-grid with `InpatientCard` list +
      free-bed placeholders; expand waiting list to `WaitingPatientRow` rows + footer;
      disable bed + button when `!snapshot.canAddBed`.
- [ ] `app/web/e2e/ward.spec.ts` — add test: patient cards appear after admission
      at speed-60.

---

## §6 — Resource constraint visualization

### ❓ Outstanding questions

- None. Bottleneck decision logic is settled in design §5.2.

### Description

Surface the current bottleneck and show the nurse-acuity split. Add a bottleneck
badge to the resource panel, a throughput counter, and a nurse allocation breakdown.

### Acceptance criteria

- `packages/scoring/src/bottleneck.ts` exports `analyseBottleneck` and
  `BottleneckAnalysis`.
- `packages/scoring/src/throughput.ts` exports `computeThroughputRate`.
- Both files at **100% coverage**.
- `BottleneckBadge.svelte` renders the correct colour and text for each kind.
- `GameSnapshot` includes `bottleneck`, `throughputPerDay`, `nurseSplit`.
- Nurse panel shows "X ward / Y procedures / Z free".
- Throughput counter shows "X.X discharges/day".
- Queue growing/stable indicator updates on each frame.
- Web package at **≥80% coverage**.
- E2e: bottleneck badge is visible on page load.

### Tasks

**Scoring**
- [ ] `scoring/src/bottleneck.ts` (new) — `analyseBottleneck` with decision logic.
- [ ] `scoring/src/bottleneck.test.ts` (new) — one describe per branch (6 branches).
- [ ] `scoring/src/throughput.ts` (new) — `computeThroughputRate`.
- [ ] `scoring/src/throughput.test.ts` (new) — zero simTime, one discharge, many.
- [ ] `scoring/src/index.ts` — re-export new functions and types.

**Game controller**
- [ ] `web/src/lib/game.ts` — add `bottleneck`, `throughputPerDay`, `nurseSplit` to
      `GameSnapshot`; call `analyseBottleneck` and `computeThroughputRate` in
      `snapshot()`.

**Svelte**
- [ ] `web/src/lib/BottleneckBadge.svelte` — four-state badge with pulse ring.
- [ ] `web/src/routes/+page.svelte`:
  - Add `BottleneckBadge` to resource panel header.
  - Replace nurse count with "X ward / Y procedures / Z free" layout.
  - Add throughput line below Treated counter.
  - Add "Queue growing" / "Queue stable" indicator with previous-frame comparison.

**E2e**
- [ ] `ward.spec.ts` — add: bottleneck badge is present on page load; nurse split
      text is visible.

---

## Cross-cutting definition of done (every section)

- [ ] Coverage thresholds met (100% pure packages / 80% web) with no `istanbul
      ignore` escapes unless justified in review.
- [ ] Lint + typecheck clean; import boundaries intact.
- [ ] Works on Windows and macOS.
- [ ] Engine knows nothing of Svelte / HTTP / HL7 / scoring (boundary preserved).
- [ ] TypeSpec schema is the source of truth; generated TS types are never
      hand-maintained in parallel.
