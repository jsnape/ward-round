# Stage 1 Specification — Elective General Medicine Ward (NHS Mode)

**Status:** Draft v0.2 — open questions resolved; ready for implementation.
**Scope:** The smallest version of the simulation that proves the core loop is worth playing.

---

## 1. Purpose of this document

This spec defines Stage 1 only: a single elective general medicine ward, running
in NHS mode, with no spatial/building layer, no second department, and no USA
pricing mode. Those are deliberately deferred.

It wears three hats simultaneously, and is written to satisfy all three:

1. **A buildable spec** — enough to implement the Stage 1 engine and a minimal UI.
2. **A save-format foundation** — the business event stream defined here is
   intended to be complete enough to reconstruct game state by replay.
3. **A data-feed contract** — the business event schema is a *versioned interface*
   that downstream projects will consume, and is not to be changed casually.

The guiding architectural principle, carried from the design conversation:
**the simulation engine is a neutral machine that moves patients through resources
and rolls outcomes. Money, scoring, training, and event publishing are layers that
read from and write to that machine — never tangled into it.**

---

## 2. What Stage 1 proves

A single hypothesis: **is managing the supply/demand tension of an elective ward
engaging?** The player allocates a fixed budget across beds and staff, pulls
elective patients from a waiting list, and is scored on how many they treat and
how good the outcomes are. If reallocating resources in response to a growing
waiting list *feels* meaningful, Stage 1 has succeeded and the later layers are
worth building. If not, we have learned that cheaply.

Everything below serves that one question.

---

## 3. Core concepts and terminology

| Term | Meaning in this sim |
|------|--------------------|
| **Entity** | A simulated patient with a lifecycle. |
| **Resource** | A constrained capacity that patients seize and release: beds, doctors, nurses. |
| **Currency** | Money — spent to change capacity (hiring) or invest (deferred to Stage 2). |
| **Queue** | Patients waiting for a resource that is currently fully occupied. |
| **Outcome** | A *stochastic* (probability-based) result of treatment — not fixed. |
| **Tick** | Internal advance of simulation time (see §6 on the time model). |
| **Domain event** | A fine-grained, internal announcement of something that happened. Drives the UI. |
| **Business event** | The coarser, meaningful subset of domain events posted outward. The versioned contract. |

Note the two distinct event tiers — this distinction is load-bearing and is
detailed in §8.

---

## 4. The patient lifecycle (state machine)

Patients move through a state machine whose transitions are labelled with **HL7
ADT trigger events**. ADT is used here as the *conceptual lifecycle vocabulary*,
NOT as a runtime data format — patients are lightweight in-memory objects, not
HL7 messages.

States and the ADT-labelled transitions between them:

```
   [WaitingList]
        |
        |  A05  (pre-admit / scheduled from waiting list)
        v
   [Scheduled]
        |
        |  A01  (admit — patient seizes a bed)
        v
   [Admitted] ---------------------+
        |                          |
        |  (treatment timer runs)  |  A11 (cancel admit, before treatment starts)
        v                          v
   [InTreatment]              [Cancelled]  --> terminal
        |
        |  (outcome roll on completion)
        v
   [ReadyForDischarge]
        |
        |  A03  (discharge — releases the bed)
        v
   [Discharged]  --> terminal
```

Notes:

- **A05 (pre-admit)** models pulling a patient off the waiting list into a
  scheduled slot. Stage 1 **keeps `Scheduled` as a distinct state**: A11
  cancellation before admission but after scheduling is meaningfully different from
  never scheduling at all, and collapsing the states would create a model hole when
  cancellation causes are added.
- **A11 (cancellation)** uses a **modelled cause**: the trigger is no bed available
  at the scheduled admission time. This adds almost no code and makes the
  waiting-list tension real for the player.
- Transfer events (A02) are intentionally **out of scope** for Stage 1 — there is
  only one ward, so there is nowhere to transfer to. They arrive with the second
  department.

---

## 5. Resources and the supply side

Stage 1 resources, all expressed as **abstract integer capacities** (no spatial
representation — that is the Stage 4 building layer):

- **Beds** — a patient in `Admitted`/`InTreatment` occupies exactly one bed.
- **Doctors** — required for treatment to progress (see §7 for the staffing model).
- **Nurses** — modelled as a **per-ward headcount pool** (not a per-bed ratio).
  Below the ward minimum, treatment stalls; above the minimum, additional nurses
  provide a soft throughput bonus. The exact function is a balance question settled
  by play, but the constraint *type* is fixed: a shared integer pool.

Keeping capacity as plain numbers in Stage 1 is deliberate: the Stage 4 building
layer later makes those numbers *come from placed objects* without the engine
changing. The engine must never assume capacity is anything more than an integer.

**Staff/throughput coupling:** treatment cannot progress unless the ward has at
least the minimum doctor and nurse headcount (hard floor). Above the minimum,
additional staff provide a proportional throughput improvement (soft bonus). This
two-part model creates the meaningful hire/budget tension without over-engineering
the formula.

---

## 6. Time model

Use **discrete-event simulation (DES)**, not a fixed-tick game loop. Time jumps
from scheduled event to scheduled event (arrival, treatment completion, etc.) via
a timestamp-ordered priority queue. This is the standard operations-research
approach for queue/resource systems, is more accurate, and is less code than
per-frame updates.

The UI's clock and the simulation's event queue are separate concerns: the UI may
render at a comfortable pace (and offer pause / speed controls), while the engine
advances by events. Stage 1 should support **pause and variable speed**, since the
core loop is about observing consequences and intervening.

---

## 7. Staffing, outcomes, and the (deferred) training tradeoff

Stage 1 establishes the outcome model; the training *investment* layer is Stage 2.

- Each treatment resolves with a **stochastic outcome** — a weighted categorical
  roll over three tiers: **`good`**, **`complication`**, **`poor`**. Never a fixed
  result; never a binary success/fail (a binary model cannot express the
  throughput-vs-quality scoring tension in §9).
- In Stage 1, staff have a baseline skill that sets the base tier probabilities
  (e.g. `good: 0.70, complication: 0.20, poor: 0.10`). These are clearly-named
  parameters, one set per treatment type, so Stage 2 can make them a function of
  training without restructuring.
- **Deferred to Stage 2:** staff skill *levels* and *training* (money + time spent
  now to shift outcome probabilities later), creating the genuine strategic
  tradeoff of throughput (more staff) versus quality (better staff).

---

## 8. The two event tiers (the heart of the architecture)

This is the most important section for the data-feed and save-format goals.

### 8.1 Internal domain events

The engine emits **rich, fine-grained domain events** as it runs — e.g. bed
seized, treatment started, timer completed, outcome rolled, bed released. These:

- are plain in-memory objects with only the fields the sim actually has;
- are consumed **in full by the UI** to drive rendering;
- are an **implementation detail** — free to change as the engine evolves.

The engine has **no knowledge** of HL7, the server, or any event hub. It simply
announces what happened in its own vocabulary.

### 8.2 Business events (the versioned contract)

A separate **business-event layer** subscribes to the internal domain events and
selects/shapes the meaningful, outside-world-relevant subset. These are the events
posted to the server. They are:

- **coarse** — `PatientAdmitted`, `PatientDischarged` (with outcome),
  `WardOpened`, `StaffHired`, etc. — not every internal tick;
- a **versioned, published interface** — once a downstream project consumes them,
  their shape is a contract and must not break without a version bump;
- intended to be **complete enough to reconstruct game state by replay**, so that
  the same stream doubles as the save/resume backbone (with periodic state
  snapshots as an optimisation so resume need not replay all history).

Do not fire an HTTP post per internal tick — that is chatty UI noise no downstream
consumer wants. The business-event layer is the throttle and the translator.

### 8.3 Business event envelope

Every business event shares a common envelope. The schema carries a version from
day one:

```json
{
  "schemaVersion": "1.0.0",
  "eventId": "<uuid>",
  "gameId": "<uuid>",
  "simTime": 123456,
  "wallTime": "<ISO-8601 real timestamp of emission>",
  "type": "PatientAdmitted",
  "payload": { }
}
```

`simTime` is **integer milliseconds since game epoch** — unambiguous, easy to
order, and sufficient for replay ordering without floating-point risk.

The Stage 1 business event `type` values:

| type | When | Key payload |
|------|------|-------------|
| `GameStarted` | New game begins | mode (NHS), budget, initial capacities |
| `WardOpened` | Ward becomes operational | ward id, bed count |
| `StaffHired` | Staff added | role (doctor/nurse), count, cost |
| `PatientRegistered` | Patient enters waiting list (A04/A05 sense) | patient id, **urgency/priority**, **expected treatment duration class** |
| `PatientScheduled` | Patient pulled from waiting list (A05) | patient id, scheduled simTime |
| `PatientAdmitted` | Patient seizes a bed (A01) | patient id, simTime |
| `TreatmentStarted` | Treatment begins | patient id, expected duration |
| `PatientDischarged` | Patient leaves (A03) | patient id, **outcome** (`good`/`complication`/`poor`), length of stay |
| `AdmissionCancelled` | Cancellation (A11) | patient id, reason (`no_bed_available`) |
| `BudgetUpdated` | Budget/score state changes | spent, remaining, patients treated, outcome score |

`PatientRegistered` includes urgency/priority and treatment duration class so that
downstream replay can reconstruct waiting-list ordering without additional state.

**Note on JSON form:** whether business events are encoded as FHIR resources
(`Encounter`, `Patient`, `Location`) or as a JSON encoding of HL7 v2 ADT is a
**translation-layer decision deliberately deferred to Stage 3**, when the feed is
actually wired to the server. The envelope above is engine-native and independent
of that choice; the translator maps it to whichever wire format wins. Search the
current FHIR / event-hub tooling landscape at that point before deciding.

---

## 9. NHS mode scoring (the objective layer)

NHS mode is a **scoring layer that reads simulation state** — the engine does not
know it exists.

- Fixed budget at game start.
- Fixed standard payment **per discharge** (not per admission or treatment start).
  Cancelled admissions (A11) receive no payment, creating a clear player incentive
  to avoid them.
- **Objective:** maximise the number of patients treated *and* the quality of
  outcomes, within the fixed budget.
- The score combines throughput (patients discharged) and outcome quality weighted
  across the three tiers (`good` > `complication` > `poor`). The exact weighting
  is a balance question for play — log sufficient data in the headless DES step to
  tune it empirically.

Keeping the engine ignorant of scoring is what lets USA mode (Stage 3) be a second
scoring layer over the identical machine, adding only price elasticity.

---

## 10. Explicitly out of scope for Stage 1

Deferred, by design, to keep Stage 1 honest and small:

- Spatial layout / building / extending the hospital (**Stage 4**).
- USA pricing mode and price elasticity (**Stage 3**).
- Staff training and skill progression (**Stage 2**).
- A second department, the ED, and inter-department transfers / shared
  resources (**Stage 5**).
- Server-side simulation, real-time background execution, and multiplayer
  (not required by the design; the sim is browser-authoritative and pauses on
  close, which is normal single-player save/resume).
- Wiring the business-event stream to an actual server endpoint (the layer is
  *built* in Stage 1; pointing it at a server is switched on later).

---

## 11. Resolved design decisions

These questions were open in v0.1 and are now settled:

1. **Scheduled state:** Keep `Scheduled` as a distinct state. A11 cancellation
   before admission is semantically different from never scheduling; collapsing the
   states creates a model hole. (§4)
2. **Staff/throughput coupling:** Hard minimum (treatment stalls below minimum
   headcount) plus soft proportional bonus above it. (§5)
3. **Outcome model granularity:** Three tiers — `good`, `complication`, `poor` —
   as a weighted categorical roll. Binary success/fail cannot express the
   throughput-vs-quality scoring tension. (§7)
4. **Cancellation cause:** Modelled cause — no bed available at scheduled admission
   time. Adds almost no code; makes waiting-list tension real. (§4)
5. **Score formula:** Tune empirically after first playable; log enough data in the
   headless DES step. (§9)
6. **Replay completeness:** Rely on periodic state snapshots; pure event replay is
   fragile unless stochastic seeds are also captured. Business events remain the
   authoritative audit trail and feed contract. (§8.2)

---

## 12. Suggested build order within Stage 1

1. **DES core + internal domain event emission, headless** — patients arrive from
   a waiting list, seize beds, run a treatment timer, roll an outcome, discharge.
   Domain events are emitted from the first commit — retrofitting them later is
   painful; adding them to a fresh engine is nearly free. Validate against
   intuition (raise arrival rate → queue grows, log confirms event stream).
3. **Player controls + scoring** — budget, bed/staff dials, NHS score readout.
   This is where the core hypothesis is actually tested.
4. **Minimal legible UI** — waiting list, beds filling/emptying, queue length,
   clock, score. Make the existing dynamics *felt*; add no new ones.
5. **Business-event layer** — select/shape domain events into the versioned
   business stream, emitting locally (console / in-memory) with the server post
   switched off. Locks the v1 contract.
