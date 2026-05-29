import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG, MS_PER_DAY } from "../config/defaults.js";
import type { EngineConfig } from "../config/types.js";
import type { DomainEvent } from "../domain/events.js";
import { createRng } from "../rng/rng.js";
import { IdGenerator } from "../util/id.js";
import { type Patient, PatientState, createPatient } from "../state/patient.js";
import { createWorldState } from "../state/worldState.js";
import { type ScheduledEvent, EventScheduler } from "../sim/scheduler.js";
import type { SimContext } from "../sim/simulation.js";
import { admitWaiting } from "./admission.js";
import { handleArrival } from "./arrivalHandler.js";
import { handleTreatmentComplete } from "./treatmentHandler.js";
import { handleDischarge } from "./dischargeHandler.js";
import { handleBedManagerRound } from "./bedManagerHandler.js";

function makeContext(opts?: { config?: EngineConfig; simTime?: number }) {
    const config = opts?.config ?? DEFAULT_ENGINE_CONFIG;
    const world = createWorldState(config);
    const scheduler = new EventScheduler();
    const emitted: DomainEvent[] = [];
    const root = createRng(config.seed);
    const ctx: SimContext = {
        simTime: opts?.simTime ?? 0,
        world,
        config,
        rng: {
            arrivals: root.fork("arrivals"),
            outcomes: root.fork("outcomes"),
        },
        ids: new IdGenerator(),
        schedule: (e) => scheduler.schedule(e),
        emit: (e) => emitted.push(e),
    };
    return { ctx, world, scheduler, emitted };
}

function drain(scheduler: EventScheduler): ScheduledEvent[] {
    const out: ScheduledEvent[] = [];
    for (let e = scheduler.pop(); e !== undefined; e = scheduler.pop()) {
        out.push(e);
    }
    return out;
}

function addPatient(
    world: ReturnType<typeof createWorldState>,
    id: string,
    state: PatientState,
    extra: Partial<Patient> = {},
): Patient {
    const patient = createPatient({
        id,
        urgency: "routine",
        durationClass: "short",
        registeredAt: 0,
    });
    patient.state = state;
    Object.assign(patient, extra);
    world.patients.set(id, patient);
    return patient;
}

const withBeds = (beds: number): EngineConfig => ({
    ...DEFAULT_ENGINE_CONFIG,
    resources: { ...DEFAULT_ENGINE_CONFIG.resources, beds },
});

describe("admitWaiting", () => {
    it("admits the oldest waiters into free beds and treats when staffed", () => {
        const { ctx, world, scheduler } = makeContext({ config: withBeds(2) });
        addPatient(world, "p-1", PatientState.WaitingList);
        addPatient(world, "p-2", PatientState.WaitingList);
        addPatient(world, "p-3", PatientState.WaitingList);

        admitWaiting(ctx);

        expect(world.patients.get("p-1")?.state).toBe(PatientState.InTreatment);
        expect(world.patients.get("p-2")?.state).toBe(PatientState.InTreatment);
        expect(world.patients.get("p-3")?.state).toBe(PatientState.WaitingList);
        expect(world.resources.beds.occupied).toBe(2);
        expect(world.counters.admitted).toBe(2);
        expect(
            drain(scheduler).filter((e) => e.kind === "treatmentComplete"),
        ).toHaveLength(2);
    });

    it("seizes a bed but stalls treatment when understaffed", () => {
        const { ctx, world, scheduler } = makeContext();
        world.resources.doctors.headcount = 0; // below the floor
        addPatient(world, "p-1", PatientState.WaitingList);

        admitWaiting(ctx);

        expect(world.patients.get("p-1")?.state).toBe(PatientState.Admitted);
        expect(world.resources.beds.occupied).toBe(1);
        expect(scheduler.size).toBe(0); // no treatmentComplete scheduled
    });

    it("admits nobody when there are no free beds", () => {
        const { ctx, world, emitted } = makeContext({ config: withBeds(1) });
        world.resources.beds.occupied = 1; // full
        addPatient(world, "p-1", PatientState.WaitingList);

        admitWaiting(ctx);

        expect(world.patients.get("p-1")?.state).toBe(PatientState.WaitingList);
        expect(emitted).toEqual([]);
    });

    it("skips patients who are not waiting", () => {
        const { ctx, world } = makeContext({ config: withBeds(5) });
        addPatient(world, "p-1", PatientState.Discharged);
        addPatient(world, "p-2", PatientState.WaitingList);

        admitWaiting(ctx);

        expect(world.patients.get("p-1")?.state).toBe(PatientState.Discharged);
        expect(world.patients.get("p-2")?.state).toBe(PatientState.InTreatment);
    });
});

describe("handleArrival", () => {
    it("registers, perpetuates arrivals, and admits into a free bed", () => {
        const { ctx, world, scheduler, emitted } = makeContext();
        handleArrival({ kind: "arrival", time: 0, seq: 0 }, ctx);

        expect(world.patients.size).toBe(1);
        expect(world.counters.registered).toBe(1);
        const patient = world.patients.get("p-1");
        expect(patient?.state).toBe(PatientState.InTreatment); // bed free + staffed
        expect(emitted.some((e) => e.kind === "PatientRegistered")).toBe(true);

        const scheduled = drain(scheduler);
        expect(
            scheduled.find((e) => e.kind === "arrival")?.time,
        ).toBeGreaterThan(0);
        expect(scheduled.some((e) => e.kind === "treatmentComplete")).toBe(
            true,
        );
    });

    it("leaves the patient on the waiting list when beds are full", () => {
        const { ctx, world } = makeContext({ config: withBeds(1) });
        world.resources.beds.occupied = 1; // full
        handleArrival({ kind: "arrival", time: 0, seq: 0 }, ctx);

        expect(world.patients.get("p-1")?.state).toBe(PatientState.WaitingList);
    });
});

const forceOutcome = (
    tier: "good" | "complication" | "poor",
): EngineConfig => ({
    ...DEFAULT_ENGINE_CONFIG,
    outcomeWeights: {
        good: tier === "good" ? 1 : 0,
        complication: tier === "complication" ? 1 : 0,
        poor: tier === "poor" ? 1 : 0,
    },
});

describe("handleTreatmentComplete", () => {
    it("readies a well (good) patient for discharge immediately", () => {
        const { ctx, world, scheduler, emitted } = makeContext({
            config: forceOutcome("good"),
            simTime: 500,
        });
        addPatient(world, "p-1", PatientState.InTreatment, {
            admittedAt: 0,
            treatmentStartedAt: 0,
        });
        handleTreatmentComplete(
            { kind: "treatmentComplete", time: 500, seq: 0, patientId: "p-1" },
            ctx,
        );

        const patient = world.patients.get("p-1");
        expect(patient?.state).toBe(PatientState.ReadyForDischarge);
        expect(patient?.outcome).toBe("good");
        expect(emitted.map((e) => e.kind)).toEqual(["OutcomeRolled"]);
        expect(drain(scheduler).map((e) => e.kind)).toEqual(["discharge"]);
    });

    it("keeps a not-well (complication) patient recovering in the bed", () => {
        const { ctx, world, scheduler, emitted } = makeContext({
            config: forceOutcome("complication"),
            simTime: 500,
        });
        addPatient(world, "p-1", PatientState.InTreatment, {
            admittedAt: 0,
            treatmentStartedAt: 0,
        });
        handleTreatmentComplete(
            { kind: "treatmentComplete", time: 500, seq: 0, patientId: "p-1" },
            ctx,
        );

        const patient = world.patients.get("p-1");
        expect(patient?.state).toBe(PatientState.InTreatment); // not well yet
        expect(patient?.outcome).toBe("complication");
        expect(emitted.map((e) => e.kind)).toEqual(["OutcomeRolled"]);
        const next = drain(scheduler);
        expect(next.map((e) => e.kind)).toEqual(["treatmentComplete"]);
        expect(next[0]?.time).toBe(500 + 2 * MS_PER_DAY); // recovery extension
    });

    it("discharges a recovered patient on the second completion (no re-roll)", () => {
        const { ctx, world, scheduler, emitted } = makeContext({
            config: forceOutcome("complication"),
            simTime: 900,
        });
        addPatient(world, "p-1", PatientState.InTreatment, {
            admittedAt: 0,
            outcome: "complication", // already rolled — this is the recovery completion
        });
        handleTreatmentComplete(
            { kind: "treatmentComplete", time: 900, seq: 0, patientId: "p-1" },
            ctx,
        );

        expect(world.patients.get("p-1")?.state).toBe(
            PatientState.ReadyForDischarge,
        );
        expect(emitted).toEqual([]); // no second OutcomeRolled
        expect(drain(scheduler).map((e) => e.kind)).toEqual(["discharge"]);
    });

    it("no-ops when the patient is missing or not in treatment", () => {
        const missing = makeContext();
        handleTreatmentComplete(
            { kind: "treatmentComplete", time: 0, seq: 0, patientId: "ghost" },
            missing.ctx,
        );
        expect(missing.emitted).toEqual([]);

        const wrong = makeContext();
        addPatient(wrong.world, "p-1", PatientState.Admitted);
        handleTreatmentComplete(
            { kind: "treatmentComplete", time: 0, seq: 0, patientId: "p-1" },
            wrong.ctx,
        );
        expect(wrong.emitted).toEqual([]);
    });
});

describe("handleDischarge", () => {
    it("discharges, releases the bed, reports LOS, and pulls the next waiter", () => {
        const { ctx, world, emitted } = makeContext({ simTime: 100 });
        world.resources.beds.occupied = 1;
        addPatient(world, "p-1", PatientState.ReadyForDischarge, {
            admittedAt: 40,
            outcome: "good",
        });
        addPatient(world, "p-2", PatientState.WaitingList);

        handleDischarge(
            { kind: "discharge", time: 100, seq: 0, patientId: "p-1" },
            ctx,
        );

        expect(world.patients.get("p-1")?.state).toBe(PatientState.Discharged);
        expect(world.counters.discharged).toBe(1);
        const discharged = emitted.find((e) => e.kind === "PatientDischarged");
        if (discharged?.kind === "PatientDischarged") {
            expect(discharged.outcome).toBe("good");
            expect(discharged.lengthOfStay).toBe(60);
        }
        // freed bed pulled the next waiter
        expect(world.patients.get("p-2")?.state).toBe(PatientState.InTreatment);
    });

    it("no-ops when the patient is missing or not ready for discharge", () => {
        const missing = makeContext();
        handleDischarge(
            { kind: "discharge", time: 0, seq: 0, patientId: "ghost" },
            missing.ctx,
        );
        expect(missing.emitted).toEqual([]);

        const wrong = makeContext();
        addPatient(wrong.world, "p-1", PatientState.InTreatment);
        handleDischarge(
            { kind: "discharge", time: 0, seq: 0, patientId: "p-1" },
            wrong.ctx,
        );
        expect(wrong.emitted).toEqual([]);
    });
});

describe("handleBedManagerRound", () => {
    const NOW = 3 * MS_PER_DAY;
    const HORIZON_END = NOW + MS_PER_DAY; // forecastHorizonMs = 1 day

    it("cancels only the overflow beyond free + expected-soon beds", () => {
        const { ctx, world, scheduler, emitted } = makeContext({
            simTime: NOW,
        });
        world.resources.beds.occupied = world.resources.beds.capacity; // full

        // One bed expected to free within the horizon (counts toward capacity)…
        addPatient(world, "p-soon", PatientState.InTreatment, {
            expectedDischargeAt: NOW + MS_PER_DAY / 2,
        });
        // …one beyond the horizon (does not count)…
        addPatient(world, "p-late", PatientState.InTreatment, {
            expectedDischargeAt: NOW + 5 * MS_PER_DAY,
        });
        // …one with no estimate (does not count)…
        addPatient(world, "p-noeta", PatientState.Admitted);
        // …and a non-bed patient (skipped entirely).
        addPatient(world, "p-done", PatientState.Discharged);

        // Three long-waiters (each waited 3 days >= maxWait 2 days), oldest first.
        addPatient(world, "w1", PatientState.WaitingList, { registeredAt: 0 });
        addPatient(world, "w2", PatientState.WaitingList, { registeredAt: 0 });
        addPatient(world, "w3", PatientState.WaitingList, { registeredAt: 0 });

        handleBedManagerRound(
            { kind: "bedManagerRound", time: NOW, seq: 0 },
            ctx,
        );

        // capacity = 0 free + 1 expected-soon = 1 → keep oldest 1, cancel 2.
        expect(world.patients.get("w1")?.state).toBe(PatientState.WaitingList);
        expect(world.patients.get("w2")?.state).toBe(PatientState.Cancelled);
        expect(world.patients.get("w3")?.state).toBe(PatientState.Cancelled);
        expect(world.counters.cancelled).toBe(2);
        expect(
            emitted.every(
                (e) =>
                    e.kind === "AdmissionCancelled" &&
                    e.reason === "no_bed_available",
            ),
        ).toBe(true);
        expect(HORIZON_END).toBe(4 * MS_PER_DAY);

        const next = drain(scheduler);
        expect(next.map((e) => e.kind)).toEqual(["bedManagerRound"]);
        expect(next[0]?.time).toBe(NOW + MS_PER_DAY);
    });

    it("optimism spares long-waiters when enough beds are expected to free", () => {
        const { ctx, world, emitted } = makeContext({ simTime: NOW });
        world.resources.beds.occupied = world.resources.beds.capacity; // full

        // Three beds expected to free within the horizon.
        for (const id of ["s1", "s2", "s3"]) {
            addPatient(world, id, PatientState.InTreatment, {
                expectedDischargeAt: NOW + MS_PER_DAY / 2,
            });
        }
        // A recent waiter (under maxWait) is not a cancellation candidate.
        addPatient(world, "recent", PatientState.WaitingList, {
            registeredAt: 2.5 * MS_PER_DAY,
        });
        // One long-waiter, comfortably within expected capacity (3).
        addPatient(world, "w1", PatientState.WaitingList, { registeredAt: 0 });

        handleBedManagerRound(
            { kind: "bedManagerRound", time: NOW, seq: 0 },
            ctx,
        );

        expect(world.patients.get("w1")?.state).toBe(PatientState.WaitingList);
        expect(world.patients.get("recent")?.state).toBe(
            PatientState.WaitingList,
        );
        expect(world.counters.cancelled).toBe(0);
        expect(emitted).toEqual([]);
    });
});
