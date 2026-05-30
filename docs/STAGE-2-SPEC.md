# Stage 2 Specification — Engagement Overhaul

**Status:** Draft v0.1 — ready for implementation.
**Scope:** Deepen engagement with the core loop before adding new mechanics.

---

## 1. Purpose of this document

Stage 1 proved the hypothesis: the supply/demand tension of an elective ward *can*
be engaging. Playtesting, however, revealed six gaps that make Stage 1 feel abstract
rather than gripping:

1. **Resource opacity** — it is not obvious which resource (beds, doctors, nurses)
   is causing the queue to grow.
2. **Too easy** — the ward never fails at default settings; staff must be reduced to
   zero before pressure builds.
3. **Budget is irrelevant** — a £1M budget that shrinks by £1k per discharge gives
   no moment-to-moment financial tension.
4. **Invisible patients** — the ward feels like a counter ticking upward; individual
   patients are not felt.
5. **Speed mismatch** — 1 sim-day per real-second means a year passes in 5 minutes,
   too fast to observe a single patient's journey.
6. **Abstract scheduling** — "short/medium/long duration class" means nothing;
   patients need a *reason* to be there.

Stage 2 addresses all six before adding any new mechanics. No new patient lifecycle
states, no new ward, no USA mode, no staff training. The engine core from Stage 1
is preserved; the changes are to the resource model, configuration defaults, scoring,
and the UI.

Three new design rules govern Stage 2:

- **Nurse-bed acuity coupling** — a ward has an acuity rating (minimum nurses per
  bed). Beds cannot be added unless nurse headcount can sustain the new acuity load.
- **Procedures consume staff** — each active treatment ties up one doctor and one
  nurse. Staff are a concurrent-capacity pool, not a headcount gate.
- **Specialty foundation** — every procedure declares a `requiredSpecialty`. In
  Stage 2 all procedures require `"general_medicine"` and all doctors practice
  general medicine. The type is introduced now so Stage 3+ can add per-doctor
  specialties without a breaking schema change.

---

## 2. What Stage 2 proves

The same hypothesis as Stage 1 — is managing the tension engaging? — but now that
question needs to feel answerable. A player must:

- understand *why* the queue is growing (which resource is the bottleneck);
- feel that staff decisions have immediate financial consequences;
- experience individual patients with named procedures rather than abstract counts;
- be able to watch a single patient journey at a comfortable pace.

If all six gaps are closed, the core loop is demonstrably engaging and Stages 3+
(USA pricing mode, staff training) can build on a foundation players want to return to.

---

## 3. Resource model changes

### 3.1 Ward acuity and nurse-bed coupling

Each ward has an **acuity** value: the minimum number of nurses required per bed
(fractional; `ceil` to the nearest integer). For a general medicine ward the acuity
is **0.5** — one nurse per two beds.

This creates two constraints:

1. **Ward coverage floor:** at all times, `ceil(beds.capacity × acuity)` nurses are
   occupied with ward duties. These nurses are unavailable for procedure assistance.
2. **Bed-addition gate:** a bed cannot be opened unless the resulting acuity load is
   covered. `canAddBed` returns false when `nurses < ceil((beds.capacity + 1) × acuity)`.

The acuity value is a `ward` config block, not a staffing floor — it is a property
of the clinical environment, not a tuning knob.

### 3.2 Procedures consume staff

In Stage 1, treatment could proceed if aggregate headcount exceeded a floor.
In Stage 2, **each active treatment reserves one doctor and one nurse** from the
ward's free pool (the pool that remains after subtracting ward-coverage nurses).

Consequences:

- With 3 doctors and 2 procedures already running, a third cannot start even if
  the third doctor is "free" — unless a nurse is also free.
- Reducing doctors mid-shift does not cancel in-flight treatments (you cannot pull
  a surgeon out mid-procedure), but it prevents new treatments from starting if the
  free count drops to zero.
- Adding a nurse costs money *and* is immediately visible in the free-nurse count,
  giving the hire-or-wait decision immediate feedback.

The `StaffingConfig` (minDoctors, minNurses, softBonusPerExtra) from Stage 1 is
**removed entirely**. The nurse-acuity model plus per-treatment allocation replaces it.

The throughput-multiplier (which made extra staff speed up treatments) is also
removed. The benefit of extra staff is now structural: more staff → more procedures
can run simultaneously → higher throughput.

### 3.3 Specialty foundation

Each procedure declares `requiredSpecialty: SpecialtyId`. In Stage 2, `SpecialtyId`
is the unit type `"general_medicine"`, and treatment gating ignores it (any doctor
can treat any procedure). The field is first-class in the schema so that Stage 3+
can add:

- per-doctor specialty tracking (a doctor has a set of qualifications);
- senior tiers (some complex procedures require a senior doctor);
- specialty training costs (investment now → capability later).

These are explicitly out of scope for Stage 2.

---

## 4. Procedure catalog

`durationClass: "short" | "medium" | "long"` is replaced by `procedureId: ProcedureId`,
referencing a catalog of named NHS general medicine procedures. The procedure drives:

- **Duration** (base, before any future modifiers)
- **Outcome risk** (minor procedures have a reduced complication probability)
- **Urgency eligibility** (not every procedure is appropriate for every urgency)
- **Arrival weight** (how frequently this procedure appears on the waiting list)

The Stage 2 catalog (all requiring `"general_medicine"` specialty):

| id | Name | Duration | Complexity | Eligible urgencies |
|---|---|---|---|---|
| `appendectomy` | Appendectomy | 1 day | minor | urgent, emergency |
| `hernia_repair` | Hernia Repair | 1 day | minor | routine, urgent |
| `cataract_surgery` | Cataract Surgery | 1 day | minor | routine |
| `colonoscopy` | Colonoscopy | 1 day | minor | routine, urgent |
| `cholecystectomy` | Cholecystectomy | 2 days | major | routine, urgent, emergency |
| `tonsillectomy` | Tonsillectomy | 2 days | minor | routine, urgent |
| `knee_arthroscopy` | Knee Arthroscopy | 3 days | major | routine, urgent |
| `cardiac_stent` | Cardiac Stent | 3 days | major | urgent, emergency |
| `hip_replacement` | Hip Replacement | 7 days | major | routine, urgent |
| `lumbar_fusion` | Lumbar Fusion | 10 days | major | routine, urgent |

Minor-complexity procedures shift the complication probability down by 0.05
(redistributed to good), making complexity meaningful at the outcome level.

The arrival draw samples a procedure compatible with the patient's urgency; only
procedures whose `urgencyEligibility` includes the patient's urgency are eligible.
This prevents emergency colonoscopies.

---

## 5. Scoring changes

### 5.1 Daily staffing costs

The budget is no longer drained only by discharges. Staff and beds have ongoing
daily costs:

- Each doctor: **£500 per sim-day**
- Each nurse: **£200 per sim-day**
- Each bed (open): **£50 per sim-day**

These are computed as a pure function of `worldState.simTime` and current
headcounts in the scoring package. The engine is ignorant of costs.

A game at default settings (3 doctors, 6 nurses, 8 beds) burns approximately
**£3,100 per sim-day** in staffing costs, earning approximately £5,000 per sim-day
in discharge revenue at expected throughput. The margin is thin; any queue build-up
or cancellation swings the balance.

### 5.2 Revised default budget

| Parameter | Stage 1 | Stage 2 |
|---|---|---|
| Starting budget | £1,000,000 | £60,000 |
| Payment per discharge | £1,000 | £2,500 |

The new budget sustains roughly 20 sim-days at default staffing before requiring
discharges to offset costs, with no room to idle.

---

## 6. Simulation speed

The default simulation rate changes from 1 sim-day per real-second to
**1 sim-day per real-minute**. Speed presets are renamed and revalued:

| Label | Multiplier | 1 sim-day = |
|---|---|---|
| Live | 1× | 1 real-minute |
| Daily | 4× | 15 real-seconds |
| Weekly | 20× | 3 real-seconds |
| Turbo | 60× | 1 real-second (original default) |

At "Live" pace a short procedure (appendectomy, 1 day) is visible for a full
real-minute. A long procedure (lumbar fusion, 10 days) occupies a bed for 10
real-minutes, making the bed pressure visible and felt.

---

## 7. UI changes

### 7.1 Patient visibility

- Admitted patients are shown individually with their procedure name, a
  treatment-progress bar, and an outcome badge when available.
- The waiting list shows the first 10 patients with their urgency, procedure name,
  and wait duration.

### 7.2 Resource constraint visualization

- A bottleneck badge identifies the current constraining resource (beds, doctors, or
  nurses) or indicates the ward is balanced.
- The nurse panel shows the split between ward-coverage nurses and
  procedure-assigned nurses, making the acuity model visible.
- The bed + dial is disabled with a tooltip when nurse headcount cannot support the
  new bed's acuity load.
- A live throughput rate (discharges per sim-day) is shown alongside the score.

---

## 8. Explicitly out of scope for Stage 2

- Per-doctor specialty tracking and senior doctor tiers (**Stage 3**).
- Staff training investment (money + time → better outcome probabilities) (**Stage 3**).
- USA pricing mode and price elasticity (**Stage 3**).
- A second department/ward (**Stage 5**).
- Spatial layout / building (**Stage 4**).
- Save/load UI (save format tested in Stage 1; UI surface deferred).
- Server-side simulation and multiplayer.

---

## 9. Resolved design decisions

1. **Acuity applies to bed capacity, not occupied beds.** Opening a bed is a
   commitment to needing nursing coverage when it fills. The constraint uses capacity
   so that the player cannot open a bed and wait for it to fill before hiring the
   nurse. (§3.1)
2. **In-flight treatments continue if staff is reduced below the active count.**
   Pulling a doctor out mid-procedure is not modelled. A warning is shown in the UI
   when staff headcount is at or below the in-treatment count. (§3.2)
3. **No throughput multiplier.** The benefit of extra staff is parallelism, not
   faster individual treatments. This is simpler, more intuitive, and removes a
   non-obvious knob. (§3.2)
4. **Daily costs are computed in scoring, not the engine.** The engine is, and
   remains, ignorant of money. Costs are a pure function of world-state read-model
   fields already available to scoring. (§5.1)
5. **Procedure draw filters by urgency eligibility.** An emergency patient draws
   only from emergency-eligible procedures. This makes the urgency field meaningful
   even before urgency-priority scheduling arrives (Stage 3). (§4)
