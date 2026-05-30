import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG, MS_PER_DAY } from "../config/defaults.js";
import type { DomainEvent } from "../domain/events.js";
import { type Patient, PatientState, createPatient } from "../state/patient.js";
import type { PortableState } from "../state/worldState.js";
import {
    createWardSimulation,
    createWardSimulationFromSnapshot,
} from "./ward.js";

function runWard(seed: number, events = 3000) {
    const sim = createWardSimulation({ ...DEFAULT_ENGINE_CONFIG, seed });
    const emitted: DomainEvent[] = [];
    sim.subscribe((e) => emitted.push(e));
    sim.start();
    sim.run(events);
    return { sim, emitted };
}

describe("createWardSimulation", () => {
    it("runs a full lifecycle end to end and discharges patients", () => {
        const { sim, emitted } = runWard(7);

        expect(emitted[0]?.kind).toBe("GameStarted");
        const discharges = emitted.filter(
            (e) => e.kind === "PatientDischarged",
        );
        expect(discharges.length).toBeGreaterThan(0);
        expect(sim.state.counters.discharged).toBe(discharges.length);

        // Every discharged patient ended in a terminal Discharged state.
        const discharged = sim.state.patients.filter(
            (p) => p.state === PatientState.Discharged,
        );
        expect(discharged.length).toBe(discharges.length);
        for (const p of discharged) {
            expect(p.outcome).toBeDefined();
        }
    });

    it("registers equal numbers of patients to PatientRegistered events", () => {
        const { sim, emitted } = runWard(7);
        const registered = emitted.filter(
            (e) => e.kind === "PatientRegistered",
        );
        expect(sim.state.counters.registered).toBe(registered.length);
    });

    it("is deterministic for a given seed", () => {
        const a = runWard(123);
        const b = runWard(123);
        expect(a.sim.state.counters).toEqual(b.sim.state.counters);
        expect(a.emitted.length).toBe(b.emitted.length);
    });

    it("admits waiting patients when beds are added (live reallocation)", () => {
        // One bed, high arrival: a queue builds with no cancellations.
        const sim = createWardSimulation({
            ...DEFAULT_ENGINE_CONFIG,
            seed: 5,
            resources: { beds: 1, doctors: 5, nurses: 8 },
            arrivals: {
                ...DEFAULT_ENGINE_CONFIG.arrivals,
                meanInterArrivalMs: MS_PER_DAY / 10,
            },
            bedManager: {
                ...DEFAULT_ENGINE_CONFIG.bedManager,
                firstRoundAt: 1_000_000 * MS_PER_DAY,
            },
        });
        sim.start();
        sim.runUntil(20 * MS_PER_DAY);
        const queued = sim.state.waitingListLength;
        expect(queued).toBeGreaterThan(1);

        // Add beds: the sweep should immediately pull waiters off the list.
        sim.setBeds(20);
        expect(sim.state.waitingListLength).toBeLessThan(queued);
        expect(sim.state.beds.occupied).toBeGreaterThan(1);
    });
});

describe("createWardSimulationFromSnapshot", () => {
    it("snapshots a live game and resumes it, continuing forward", () => {
        const { sim } = runWard(7);
        const snapshot = sim.snapshot();
        const beforeDischarged = snapshot.counters.discharged;
        expect(beforeDischarged).toBeGreaterThan(0);

        const resumed = createWardSimulationFromSnapshot(snapshot, {
            ...DEFAULT_ENGINE_CONFIG,
            seed: 7,
        });
        const emitted: DomainEvent[] = [];
        resumed.subscribe((e) => emitted.push(e));
        resumed.start();
        expect(resumed.simTime).toBe(snapshot.simTime);
        // Resume does not replay history.
        expect(emitted.some((e) => e.kind === "GameStarted")).toBe(false);

        resumed.run(2000);
        expect(resumed.state.counters.discharged).toBeGreaterThan(
            beforeDischarged,
        );
    });

    it("re-derives pending events for in-flight, ready, and waiting patients", () => {
        const mk = (
            id: string,
            state: PatientState,
            extra: Partial<Patient> = {},
        ): Patient => {
            const p = createPatient({
                id,
                urgency: "routine",
                durationClass: "short",
                registeredAt: 0,
            });
            p.state = state;
            Object.assign(p, extra);
            return p;
        };
        const snapshot: PortableState = {
            simTime: 10 * MS_PER_DAY,
            resources: {
                beds: { capacity: 3, occupied: 3 },
                doctors: { headcount: 3 },
                nurses: { headcount: 5 },
            },
            counters: {
                registered: 4,
                admitted: 3,
                discharged: 0,
                cancelled: 0,
            },
            patients: [
                mk("in", PatientState.InTreatment, {
                    admittedAt: 9 * MS_PER_DAY,
                    expectedDischargeAt: 11 * MS_PER_DAY,
                }),
                // No expectedDischargeAt — reschedules at the current sim time.
                mk("in2", PatientState.InTreatment, {
                    admittedAt: 9 * MS_PER_DAY,
                }),
                mk("ready", PatientState.ReadyForDischarge, {
                    admittedAt: 9 * MS_PER_DAY,
                    outcome: "good",
                }),
                mk("wait", PatientState.WaitingList),
            ],
        };

        const resumed = createWardSimulationFromSnapshot(snapshot);
        resumed.start();
        // The ready patient discharges, freeing a bed the waiter takes; the
        // in-treatment patients complete — all progress past their snapshot state.
        resumed.run(2000);
        const byId = new Map(
            resumed.state.patients.map((p) => [p.id, p.state]),
        );
        expect(byId.get("ready")).toBe(PatientState.Discharged);
        expect(byId.get("in")).toBe(PatientState.Discharged);
        expect(byId.get("in2")).toBe(PatientState.Discharged);
        expect(byId.get("wait")).not.toBe(PatientState.WaitingList);
    });
});
