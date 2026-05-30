import { describe, expect, it } from "vitest";
import type {
    DomainEventListener,
    PortableState,
    Simulation,
    WorldStateReadModel,
} from "@ward-round/engine";
import {
    DEFAULT_SIM_MS_PER_WALL_MS,
    SPEED_PRESETS,
    SimDriver,
} from "./driver.js";

/** Records runUntil targets and advances its own clock to them. */
class FakeSim implements Simulation {
    simTime = 0;
    started = false;
    readonly targets: number[] = [];
    start(): void {
        this.started = true;
    }
    step(): boolean {
        return false;
    }
    runUntil(until: number): number {
        this.targets.push(until);
        const processed = until - this.simTime;
        this.simTime = until;
        return processed;
    }
    run(): number {
        return 0;
    }
    subscribe(_listener: DomainEventListener): () => void {
        return () => {};
    }
    get state(): WorldStateReadModel {
        return {
            simTime: this.simTime,
            beds: { capacity: 1, occupied: 0, free: 1 },
            doctors: 1,
            nurses: 1,
            waitingListLength: 0,
            patients: [],
            counters: {
                registered: 0,
                admitted: 0,
                discharged: 0,
                cancelled: 0,
            },
        };
    }
    snapshot(): PortableState {
        return {
            simTime: this.simTime,
            resources: {
                beds: { capacity: 1, occupied: 0 },
                doctors: { headcount: 1 },
                nurses: { headcount: 1 },
            },
            counters: {
                registered: 0,
                admitted: 0,
                discharged: 0,
                cancelled: 0,
            },
            patients: [],
        };
    }
    setBeds(): void {}
    setDoctors(): void {}
    setNurses(): void {}
}

describe("SimDriver", () => {
    it("starts un-paused at speed 1 and exposes passthroughs", () => {
        const sim = new FakeSim();
        const driver = new SimDriver(sim);
        driver.start();
        expect(sim.started).toBe(true);
        expect(driver.paused).toBe(false);
        expect(driver.speed).toBe(1);
        expect(driver.simTime).toBe(0);
        expect(driver.state.beds.capacity).toBe(1);
    });

    it("maps wall time to sim time and advances forward", () => {
        const sim = new FakeSim();
        const driver = new SimDriver(sim);
        const processed = driver.tick(1000); // 1 real second → 1 sim hour
        expect(sim.targets).toEqual([DEFAULT_SIM_MS_PER_WALL_MS * 1000]);
        expect(processed).toBe(DEFAULT_SIM_MS_PER_WALL_MS * 1000);
        expect(driver.simTime).toBe(DEFAULT_SIM_MS_PER_WALL_MS * 1000);
    });

    it("scales the budget by speed", () => {
        const sim = new FakeSim();
        const driver = new SimDriver(sim, { simMsPerWallMs: 1, speed: 2 });
        driver.tick(100);
        expect(sim.targets).toEqual([200]);
    });

    it("does nothing while paused", () => {
        const sim = new FakeSim();
        const driver = new SimDriver(sim, { simMsPerWallMs: 1 });
        driver.pause();
        expect(driver.tick(100)).toBe(0);
        driver.resume();
        expect(driver.tick(100)).toBe(100);
    });

    it("ignores non-positive deltas and sub-millisecond budgets", () => {
        const sim = new FakeSim();
        const driver = new SimDriver(sim, { simMsPerWallMs: 0.4 });
        expect(driver.tick(0)).toBe(0);
        expect(driver.tick(-5)).toBe(0);
        expect(driver.tick(1)).toBe(0); // floor(0.4) === 0
        expect(sim.targets).toEqual([]);
    });

    it("rejects a non-positive speed", () => {
        const driver = new SimDriver(new FakeSim());
        expect(() => driver.setSpeed(0)).toThrow(RangeError);
        driver.setSpeed(5);
        expect(driver.speed).toBe(5);
    });

    it("offers the documented speed presets", () => {
        expect(SPEED_PRESETS).toEqual([1, 2, 5]);
    });

    it("passes subscribe through to the simulation", () => {
        const sim = new FakeSim();
        const driver = new SimDriver(sim);
        const unsubscribe = driver.subscribe(() => {});
        expect(typeof unsubscribe).toBe("function");
    });
});
