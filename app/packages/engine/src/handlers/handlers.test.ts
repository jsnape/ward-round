import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG } from "../config/defaults.js";
import type { EngineConfig } from "../config/types.js";
import type { DomainEvent } from "../domain/events.js";
import { createRng } from "../rng/rng.js";
import { IdGenerator } from "../util/id.js";
import { type Patient, PatientState, createPatient } from "../state/patient.js";
import { createWorldState } from "../state/worldState.js";
import { type ScheduledEvent, EventScheduler } from "../sim/scheduler.js";
import type { SimContext } from "../sim/simulation.js";
import { handleArrival } from "./arrivalHandler.js";
import { handleSchedule } from "./scheduleHandler.js";
import { handleAdmit } from "./admitHandler.js";
import { handleTreatmentComplete } from "./treatmentHandler.js";
import { handleDischarge } from "./dischargeHandler.js";

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

describe("handleArrival", () => {
    it("registers a patient and perpetuates the arrival stream", () => {
        const { ctx, world, scheduler, emitted } = makeContext({ simTime: 0 });
        handleArrival({ kind: "arrival", time: 0, seq: 0 }, ctx);

        expect(world.patients.size).toBe(1);
        const patient = world.patients.get("p-1");
        expect(patient?.state).toBe(PatientState.WaitingList);
        expect(world.counters.registered).toBe(1);

        const registered = emitted.find((e) => e.kind === "PatientRegistered");
        expect(registered).toBeDefined();

        const scheduled = drain(scheduler);
        const nextArrival = scheduled.find((e) => e.kind === "arrival");
        const schedule = scheduled.find((e) => e.kind === "schedule");
        expect(nextArrival?.time).toBeGreaterThan(0);
        expect(schedule?.time).toBe(0);
    });
});

describe("handleSchedule", () => {
    it("moves a waiting patient to Scheduled and queues admit", () => {
        const { ctx, world, scheduler, emitted } = makeContext();
        addPatient(world, "p-1", PatientState.WaitingList);
        handleSchedule(
            { kind: "schedule", time: 0, seq: 0, patientId: "p-1" },
            ctx,
        );

        expect(world.patients.get("p-1")?.state).toBe(PatientState.Scheduled);
        expect(emitted.map((e) => e.kind)).toEqual(["PatientScheduled"]);
        expect(drain(scheduler).map((e) => e.kind)).toEqual(["admit"]);
    });

    it("no-ops when the patient is missing", () => {
        const { ctx, scheduler, emitted } = makeContext();
        handleSchedule(
            { kind: "schedule", time: 0, seq: 0, patientId: "ghost" },
            ctx,
        );
        expect(emitted).toEqual([]);
        expect(scheduler.size).toBe(0);
    });

    it("no-ops when the patient is no longer on the waiting list", () => {
        const { ctx, world, scheduler, emitted } = makeContext();
        addPatient(world, "p-1", PatientState.Admitted);
        handleSchedule(
            { kind: "schedule", time: 0, seq: 0, patientId: "p-1" },
            ctx,
        );
        expect(emitted).toEqual([]);
        expect(scheduler.size).toBe(0);
    });
});

describe("handleAdmit", () => {
    it("seizes a bed, admits, and starts treatment when staffed", () => {
        const { ctx, world, scheduler, emitted } = makeContext({
            simTime: 1000,
        });
        addPatient(world, "p-1", PatientState.Scheduled);
        handleAdmit(
            { kind: "admit", time: 1000, seq: 0, patientId: "p-1" },
            ctx,
        );

        expect(world.patients.get("p-1")?.state).toBe(PatientState.InTreatment);
        expect(world.resources.beds.occupied).toBe(1);
        expect(world.counters.admitted).toBe(1);
        expect(emitted.map((e) => e.kind)).toEqual([
            "BedSeized",
            "PatientAdmitted",
            "TreatmentStarted",
        ]);
        // short = 1 day; multiplier = 1 + 0.1*((3-1)+(5-1)) = 1.6
        const complete = drain(scheduler);
        expect(complete.map((e) => e.kind)).toEqual(["treatmentComplete"]);
        expect(complete[0]?.time).toBe(1000 + 86_400_000 / 1.6);
    });

    it("cancels with no_bed_available when the ward is full", () => {
        const { ctx, world, scheduler, emitted } = makeContext();
        world.resources.beds.occupied = world.resources.beds.capacity;
        addPatient(world, "p-1", PatientState.Scheduled);
        handleAdmit({ kind: "admit", time: 0, seq: 0, patientId: "p-1" }, ctx);

        expect(world.patients.get("p-1")?.state).toBe(PatientState.Cancelled);
        expect(world.counters.cancelled).toBe(1);
        const cancelled = emitted[0];
        expect(cancelled?.kind).toBe("AdmissionCancelled");
        if (cancelled?.kind === "AdmissionCancelled") {
            expect(cancelled.reason).toBe("no_bed_available");
        }
        expect(scheduler.size).toBe(0);
    });

    it("admits but stalls treatment when understaffed", () => {
        const { ctx, world, scheduler, emitted } = makeContext();
        world.resources.doctors.headcount = 0; // below the floor
        addPatient(world, "p-1", PatientState.Scheduled);
        handleAdmit({ kind: "admit", time: 0, seq: 0, patientId: "p-1" }, ctx);

        expect(world.patients.get("p-1")?.state).toBe(PatientState.Admitted);
        expect(world.resources.beds.occupied).toBe(1);
        expect(emitted.map((e) => e.kind)).toEqual([
            "BedSeized",
            "PatientAdmitted",
        ]);
        expect(scheduler.size).toBe(0);
    });

    it("no-ops when the patient is missing or not Scheduled", () => {
        const missing = makeContext();
        handleAdmit(
            { kind: "admit", time: 0, seq: 0, patientId: "ghost" },
            missing.ctx,
        );
        expect(missing.emitted).toEqual([]);

        const wrong = makeContext();
        addPatient(wrong.world, "p-1", PatientState.WaitingList);
        handleAdmit(
            { kind: "admit", time: 0, seq: 0, patientId: "p-1" },
            wrong.ctx,
        );
        expect(wrong.emitted).toEqual([]);
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
    it("discharges, releases the bed, and reports length of stay", () => {
        const { ctx, world, emitted } = makeContext({ simTime: 100 });
        world.resources.beds.occupied = 1;
        addPatient(world, "p-1", PatientState.ReadyForDischarge, {
            admittedAt: 40,
            outcome: "good",
        });
        handleDischarge(
            { kind: "discharge", time: 100, seq: 0, patientId: "p-1" },
            ctx,
        );

        const patient = world.patients.get("p-1");
        expect(patient?.state).toBe(PatientState.Discharged);
        expect(world.resources.beds.occupied).toBe(0);
        expect(world.counters.discharged).toBe(1);
        const discharged = emitted.find((e) => e.kind === "PatientDischarged");
        expect(discharged?.kind).toBe("PatientDischarged");
        if (discharged?.kind === "PatientDischarged") {
            expect(discharged.outcome).toBe("good");
            expect(discharged.lengthOfStay).toBe(60);
        }
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
