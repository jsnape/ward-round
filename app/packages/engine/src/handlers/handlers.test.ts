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

describe("handleTreatmentComplete", () => {
    it("rolls an outcome, readies for discharge, and queues discharge", () => {
        const { ctx, world, scheduler, emitted } = makeContext({
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
        expect(patient?.outcome).toBeDefined();
        expect(emitted.map((e) => e.kind)).toEqual(["OutcomeRolled"]);
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
    it("cancels long-waiters, spares recent ones, and reschedules", () => {
        const { ctx, world, scheduler, emitted } = makeContext({
            simTime: 3 * MS_PER_DAY,
        });
        // maxWaitMs = 2 days
        addPatient(world, "p-old", PatientState.WaitingList, {
            registeredAt: 0,
        });
        addPatient(world, "p-new", PatientState.WaitingList, {
            registeredAt: 2.5 * MS_PER_DAY,
        });
        addPatient(world, "p-adm", PatientState.Admitted, { registeredAt: 0 });

        handleBedManagerRound(
            { kind: "bedManagerRound", time: 3 * MS_PER_DAY, seq: 0 },
            ctx,
        );

        expect(world.patients.get("p-old")?.state).toBe(PatientState.Cancelled);
        expect(world.patients.get("p-new")?.state).toBe(
            PatientState.WaitingList,
        );
        expect(world.patients.get("p-adm")?.state).toBe(PatientState.Admitted);
        expect(world.counters.cancelled).toBe(1);
        const cancelled = emitted.find((e) => e.kind === "AdmissionCancelled");
        if (cancelled?.kind === "AdmissionCancelled") {
            expect(cancelled.reason).toBe("no_bed_available");
        }
        const next = drain(scheduler);
        expect(next).toHaveLength(1);
        expect(next[0]?.kind).toBe("bedManagerRound");
        expect(next[0]?.time).toBe(3 * MS_PER_DAY + MS_PER_DAY);
    });
});
