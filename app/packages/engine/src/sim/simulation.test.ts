import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG } from "../config/defaults.js";
import type { DomainEvent } from "../domain/events.js";
import { createPatient } from "../state/patient.js";
import {
    type EventHandler,
    type HandlerRegistry,
    createSimulation,
} from "./simulation.js";

const cfg = DEFAULT_ENGINE_CONFIG;

describe("createSimulation defaults", () => {
    it("exposes initial time and read-model state", () => {
        const sim = createSimulation(cfg);
        expect(sim.simTime).toBe(0);
        expect(sim.state.beds.capacity).toBe(8);
        expect(sim.state.waitingListLength).toBe(0);
    });

    it("with no deps emits only GameStarted and then idles", () => {
        const sim = createSimulation(cfg);
        const seen: DomainEvent[] = [];
        sim.subscribe((e) => seen.push(e));
        sim.start();
        expect(seen.map((e) => e.kind)).toEqual(["GameStarted"]);
        expect(sim.run()).toBe(0);
    });
});

describe("start", () => {
    it("emits GameStarted once with an engine-native config summary", () => {
        const sim = createSimulation(cfg);
        const seen: DomainEvent[] = [];
        sim.subscribe((e) => seen.push(e));
        sim.start();
        sim.start(); // idempotent
        const starts = seen.filter((e) => e.kind === "GameStarted");
        expect(starts).toHaveLength(1);
        const gs = starts[0];
        if (gs?.kind !== "GameStarted") throw new Error("expected GameStarted");
        expect(gs.config).toEqual({ seed: 1, beds: 8, doctors: 3, nurses: 6 });
    });

    it("runs the bootstrap to seed initial events", () => {
        const handlers: HandlerRegistry = {
            arrival: (_event, ctx) => {
                const id = ctx.ids.next();
                ctx.world.patients.set(
                    id,
                    createPatient({
                        id,
                        urgency: "routine",
                        procedureId: "appendectomy",
                        registeredAt: ctx.simTime,
                    }),
                );
            },
        };
        const sim = createSimulation(cfg, {
            handlers,
            bootstrap: (ctx) => ctx.schedule({ kind: "arrival", time: 100 }),
        });
        sim.start();
        expect(sim.step()).toBe(true);
        expect(sim.simTime).toBe(100);
        expect(sim.state.patients).toHaveLength(1);
        expect(sim.step()).toBe(false);
    });
});

describe("step", () => {
    it("returns false on an empty queue", () => {
        expect(createSimulation(cfg).step()).toBe(false);
    });

    it("throws when no handler is registered for the event kind", () => {
        const sim = createSimulation(cfg, {
            bootstrap: (ctx) => ctx.schedule({ kind: "arrival", time: 10 }),
        });
        sim.start();
        expect(() => sim.step()).toThrow(/no handler/);
    });
});

describe("runUntil", () => {
    function admitsAt(times: number[]) {
        const seen: number[] = [];
        const handlers: HandlerRegistry = {
            treatmentComplete: (event) => seen.push(event.time),
        };
        const sim = createSimulation(cfg, {
            handlers,
            bootstrap: (ctx) => {
                times.forEach((t, i) =>
                    ctx.schedule({
                        kind: "treatmentComplete",
                        time: t,
                        patientId: `p-${i}`,
                    }),
                );
            },
        });
        sim.start();
        return { sim, seen };
    }

    it("processes events up to the bound and leaves simTime at the bound", () => {
        const { sim, seen } = admitsAt([50, 150]);
        expect(sim.runUntil(100)).toBe(1);
        expect(seen).toEqual([50]);
        expect(sim.simTime).toBe(100);
    });

    it("does not move time backwards for an earlier bound", () => {
        const { sim, seen } = admitsAt([50, 150]);
        sim.runUntil(100);
        expect(sim.runUntil(80)).toBe(0);
        expect(sim.simTime).toBe(100);
        expect(seen).toEqual([50]);
    });

    it("drains remaining events for a later bound", () => {
        const { sim, seen } = admitsAt([50, 150]);
        sim.runUntil(100);
        expect(sim.runUntil(200)).toBe(1);
        expect(seen).toEqual([50, 150]);
        expect(sim.simTime).toBe(200);
    });

    it("throws if a same-timestamp storm exceeds maxIterations", () => {
        const handlers: HandlerRegistry = {
            arrival: (event, ctx) =>
                ctx.schedule({ kind: "arrival", time: event.time }),
        };
        const sim = createSimulation(cfg, {
            handlers,
            bootstrap: (ctx) => ctx.schedule({ kind: "arrival", time: 0 }),
            maxIterations: 5,
        });
        sim.start();
        expect(() => sim.runUntil(100)).toThrow(/max iterations/);
    });
});

describe("run", () => {
    function dischargesAt(times: number[]) {
        const seen: number[] = [];
        const handler: EventHandler = (event) => seen.push(event.time);
        const sim = createSimulation(cfg, {
            handlers: { discharge: handler },
            bootstrap: (ctx) => {
                times.forEach((t, i) =>
                    ctx.schedule({
                        kind: "discharge",
                        time: t,
                        patientId: `p-${i}`,
                    }),
                );
            },
        });
        sim.start();
        return { sim, seen };
    }

    it("processes at most maxEvents", () => {
        const { sim, seen } = dischargesAt([10, 20, 30]);
        expect(sim.run(2)).toBe(2);
        expect(seen).toEqual([10, 20]);
    });

    it("runs to quiescence by default and then returns 0", () => {
        const { sim, seen } = dischargesAt([10, 20, 30]);
        sim.run(2);
        expect(sim.run()).toBe(1);
        expect(seen).toEqual([10, 20, 30]);
        expect(sim.run()).toBe(0);
    });
});

describe("capacity controls", () => {
    it("sets bed capacity but never below the occupied count", () => {
        const sim = createSimulation(cfg);
        sim.setBeds(20);
        expect(sim.state.beds.capacity).toBe(20);
        // Cannot drop below occupied (0 here), and rejects nonsense.
        sim.setBeds(0);
        expect(sim.state.beds.capacity).toBe(0);
    });

    it("sets staff headcount and emits StaffChanged", () => {
        const sim = createSimulation(cfg);
        const seen: string[] = [];
        sim.subscribe((e) => {
            if (e.kind === "StaffChanged") seen.push(`${e.role}:${e.count}`);
        });
        sim.setDoctors(7);
        sim.setNurses(9);
        expect(sim.state.doctors).toBe(7);
        expect(sim.state.nurses).toBe(9);
        expect(seen).toEqual(["doctor:7", "nurse:9"]);
    });

    it("rejects non-integer or negative capacities", () => {
        const sim = createSimulation(cfg);
        expect(() => sim.setBeds(1.5)).toThrow(RangeError);
        expect(() => sim.setDoctors(-1)).toThrow(RangeError);
        expect(() => sim.setNurses(-2)).toThrow(RangeError);
    });

    it("invokes the onResourcesChanged hook", () => {
        let calls = 0;
        const sim = createSimulation(cfg, {
            onResourcesChanged: () => (calls += 1),
        });
        sim.setBeds(5);
        sim.setDoctors(2);
        sim.setNurses(3);
        expect(calls).toBe(3);
    });
});

describe("subscribe", () => {
    it("delivers emitted events until unsubscribed", () => {
        const handlers: HandlerRegistry = {
            arrival: (_event, ctx) =>
                ctx.emit({
                    kind: "PatientAdmitted",
                    simTime: ctx.simTime,
                    patientId: "x",
                }),
        };
        const sim = createSimulation(cfg, {
            handlers,
            bootstrap: (ctx) => {
                ctx.schedule({ kind: "arrival", time: 5 });
                ctx.schedule({ kind: "arrival", time: 6 });
            },
        });
        const got: string[] = [];
        const unsubscribe = sim.subscribe((e) => got.push(e.kind));
        sim.start();
        sim.step();
        unsubscribe();
        sim.step();
        expect(got).toEqual(["GameStarted", "PatientAdmitted"]);
    });
});
