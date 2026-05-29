import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG } from "../config/defaults.js";
import type { DomainEvent } from "../domain/events.js";
import { PatientState } from "../state/patient.js";
import { createWardSimulation } from "./ward.js";

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
});
