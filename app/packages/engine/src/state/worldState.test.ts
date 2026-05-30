import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG } from "../config/defaults.js";
import { PatientState, createPatient } from "./patient.js";
import {
    type WorldState,
    createWorldState,
    fromPortable,
    projectReadModel,
    toPortable,
} from "./worldState.js";

describe("createWorldState", () => {
    it("starts with no patients, full capacity, and zeroed counters", () => {
        const world = createWorldState(DEFAULT_ENGINE_CONFIG);
        expect(world.patients.size).toBe(0);
        expect(world.simTime).toBe(0);
        expect(world.resources.beds).toEqual({ capacity: 8, occupied: 0 });
        expect(world.counters).toEqual({
            registered: 0,
            admitted: 0,
            discharged: 0,
            cancelled: 0,
        });
    });
});

describe("projectReadModel", () => {
    function seeded(): WorldState {
        const world = createWorldState(DEFAULT_ENGINE_CONFIG);
        world.simTime = 500;
        world.resources.beds.occupied = 3;
        const waiting = createPatient({
            id: "p-1",
            urgency: "routine",
            procedureId: "appendectomy",
            registeredAt: 0,
        });
        const discharged = createPatient({
            id: "p-2",
            urgency: "urgent",
            procedureId: "hip_replacement",
            registeredAt: 0,
        });
        discharged.state = PatientState.Discharged;
        discharged.outcome = "good";
        world.patients.set(waiting.id, waiting);
        world.patients.set(discharged.id, discharged);
        world.counters.discharged = 1;
        return world;
    }

    it("projects beds, staffing, queue length, and counters", () => {
        const view = projectReadModel(seeded());
        expect(view.simTime).toBe(500);
        expect(view.beds).toEqual({ capacity: 8, occupied: 3, free: 5 });
        expect(view.doctors).toBe(3);
        expect(view.nurses).toBe(6);
        expect(view.waitingListLength).toBe(1);
        expect(view.counters.discharged).toBe(1);
    });

    it("includes outcome only when present", () => {
        const view = projectReadModel(seeded());
        const p1 = view.patients.find((p) => p.id === "p-1");
        const p2 = view.patients.find((p) => p.id === "p-2");
        expect(p1?.outcome).toBeUndefined();
        expect(p2?.outcome).toBe("good");
    });

    it("forwards timestamp fields when set, leaves absent when not", () => {
        const world = createWorldState(DEFAULT_ENGINE_CONFIG);
        const p = createPatient({
            id: "p-tx",
            urgency: "urgent",
            procedureId: "appendectomy",
            registeredAt: 100,
        });
        p.admittedAt = 200;
        p.treatmentStartedAt = 300;
        p.expectedDischargeAt = 1000;
        world.patients.set(p.id, p);

        const view = projectReadModel(world);
        const pv = view.patients.find((x) => x.id === "p-tx");
        expect(pv?.registeredAt).toBe(100);
        expect(pv?.admittedAt).toBe(200);
        expect(pv?.treatmentStartedAt).toBe(300);
        expect(pv?.expectedDischargeAt).toBe(1000);

        // Patient without timestamps
        const plain = createPatient({
            id: "p-plain",
            urgency: "routine",
            procedureId: "colonoscopy",
            registeredAt: 0,
        });
        world.patients.set(plain.id, plain);
        const pv2 = projectReadModel(world).patients.find((x) => x.id === "p-plain");
        expect(pv2?.admittedAt).toBeUndefined();
        expect(pv2?.treatmentStartedAt).toBeUndefined();
        expect(pv2?.expectedDischargeAt).toBeUndefined();
    });

    it("returns a detached snapshot (mutating it does not affect the world)", () => {
        const world = seeded();
        const view = projectReadModel(world);
        (view.patients as unknown[]).push({});
        view.counters.discharged = 999;
        expect(world.patients.size).toBe(2);
        expect(world.counters.discharged).toBe(1);
    });
});

describe("toPortable / fromPortable", () => {
    function seeded(): WorldState {
        const world = createWorldState(DEFAULT_ENGINE_CONFIG);
        world.simTime = 1234;
        world.resources.beds.occupied = 2;
        world.counters.discharged = 3;
        const p = createPatient({
            id: "p-1",
            urgency: "urgent",
            procedureId: "hip_replacement",
            registeredAt: 0,
        });
        p.state = PatientState.InTreatment;
        p.admittedAt = 100;
        p.expectedDischargeAt = 900;
        world.patients.set(p.id, p);
        return world;
    }

    it("round-trips through a portable snapshot", () => {
        const world = seeded();
        const portable = toPortable(world);
        const restored = toPortable(fromPortable(portable));
        expect(restored).toEqual(portable);
    });

    it("produces an independent copy (mutation does not leak back)", () => {
        const world = seeded();
        const portable = toPortable(world);
        const rebuilt = fromPortable(portable);
        rebuilt.resources.beds.occupied = 99;
        rebuilt.patients.get("p-1")!.state = PatientState.Discharged;
        expect(world.resources.beds.occupied).toBe(2);
        expect(world.patients.get("p-1")?.state).toBe(PatientState.InTreatment);
    });
});
