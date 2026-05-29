/**
 * Engine acceptance scenarios: headless, fixed-seed runs that prove the emergent
 * dynamics the spec validates against. These complement the unit tests — they
 * assert behaviour of the whole machine, not individual functions.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG, MS_PER_DAY } from "../config/defaults.js";
import type { EngineConfig } from "../config/types.js";
import type { DomainEvent } from "../domain/events.js";
import { createWardSimulation } from "../handlers/ward.js";

const NEVER = 1_000_000 * MS_PER_DAY;

/** Builds a config from the defaults, allowing partial nested overrides. */
function cfg(overrides: {
    seed?: number;
    resources?: Partial<EngineConfig["resources"]>;
    arrivals?: Partial<EngineConfig["arrivals"]>;
    bedManager?: Partial<EngineConfig["bedManager"]>;
}): EngineConfig {
    return {
        ...DEFAULT_ENGINE_CONFIG,
        seed: overrides.seed ?? DEFAULT_ENGINE_CONFIG.seed,
        resources: {
            ...DEFAULT_ENGINE_CONFIG.resources,
            ...overrides.resources,
        },
        arrivals: { ...DEFAULT_ENGINE_CONFIG.arrivals, ...overrides.arrivals },
        bedManager: {
            ...DEFAULT_ENGINE_CONFIG.bedManager,
            ...overrides.bedManager,
        },
    };
}

const noCancellations = {
    firstRoundAt: NEVER,
    roundIntervalMs: MS_PER_DAY,
    maxWaitMs: NEVER,
};

function collect(config: EngineConfig, untilMs: number) {
    const sim = createWardSimulation(config);
    const emitted: DomainEvent[] = [];
    sim.subscribe((e) => emitted.push(e));
    sim.start();
    sim.runUntil(untilMs);
    return { sim, emitted };
}

describe("scenario: arrival rate drives the queue", () => {
    it("a higher arrival rate produces a longer waiting list", () => {
        const fast = collect(
            cfg({
                resources: { beds: 3, doctors: 5, nurses: 8 },
                arrivals: { meanInterArrivalMs: MS_PER_DAY / 10 },
                bedManager: noCancellations,
            }),
            30 * MS_PER_DAY,
        ).sim;
        const slow = collect(
            cfg({
                resources: { beds: 3, doctors: 5, nurses: 8 },
                arrivals: { meanInterArrivalMs: MS_PER_DAY * 2 },
                bedManager: noCancellations,
            }),
            30 * MS_PER_DAY,
        ).sim;

        expect(fast.state.waitingListLength).toBeGreaterThan(
            slow.state.waitingListLength,
        );
        expect(fast.state.waitingListLength).toBeGreaterThan(10);
    });

    it("the queue grows over time under sustained overload", () => {
        const sim = createWardSimulation(
            cfg({
                resources: { beds: 3, doctors: 5, nurses: 8 },
                arrivals: { meanInterArrivalMs: MS_PER_DAY / 10 },
                bedManager: noCancellations,
            }),
        );
        sim.start();
        sim.runUntil(15 * MS_PER_DAY);
        const early = sim.state.waitingListLength;
        sim.runUntil(30 * MS_PER_DAY);
        const late = sim.state.waitingListLength;
        expect(late).toBeGreaterThan(early);
    });
});

describe("scenario: capacity relieves the queue", () => {
    it("ample beds keep the queue bounded and discharge patients", () => {
        const { sim } = collect(
            cfg({
                resources: { beds: 200, doctors: 20, nurses: 40 },
                arrivals: { meanInterArrivalMs: MS_PER_DAY / 10 },
                bedManager: noCancellations,
            }),
            30 * MS_PER_DAY,
        );
        expect(sim.state.waitingListLength).toBeLessThan(5);
        expect(sim.state.counters.discharged).toBeGreaterThan(0);
    });
});

describe("scenario: understaffing stalls treatment", () => {
    it("below the staffing floor, beds fill but nobody is discharged", () => {
        const { sim } = collect(
            cfg({
                resources: { beds: 10, doctors: 0, nurses: 5 },
                bedManager: noCancellations,
            }),
            30 * MS_PER_DAY,
        );
        expect(sim.state.counters.discharged).toBe(0);
        expect(sim.state.counters.admitted).toBe(10); // all beds filled, stalled
        expect(sim.state.waitingListLength).toBeGreaterThan(0);
    });
});

describe("scenario: bed pressure causes batched cancellations", () => {
    it("cancels long-waiters at the bed-manager rounds (not instantly)", () => {
        const config = cfg({
            resources: { beds: 2, doctors: 5, nurses: 8 },
            arrivals: { meanInterArrivalMs: MS_PER_DAY / 10 },
            bedManager: {
                firstRoundAt: 8 * 60 * 60 * 1000,
                roundIntervalMs: MS_PER_DAY,
                maxWaitMs: MS_PER_DAY,
            },
        });
        const { sim, emitted } = collect(config, 20 * MS_PER_DAY);

        expect(sim.state.counters.cancelled).toBeGreaterThan(0);
        const cancellations = emitted.filter(
            (e) => e.kind === "AdmissionCancelled",
        );
        for (const e of cancellations) {
            if (e.kind !== "AdmissionCancelled") continue;
            expect(e.reason).toBe("no_bed_available");
            // Cancellations land on bed-manager round times, not arbitrary moments.
            const offset = e.simTime - config.bedManager.firstRoundAt;
            expect(offset % config.bedManager.roundIntervalMs).toBe(0);
        }
    });
});

describe("scenario: determinism", () => {
    it("identical config + seed produce identical event streams", () => {
        const config = cfg({ seed: 4242 });
        const a = collect(config, 20 * MS_PER_DAY).emitted;
        const b = collect(config, 20 * MS_PER_DAY).emitted;
        expect(a).toEqual(b);
        expect(a.length).toBeGreaterThan(0);
    });
});

describe("scenario: outcome distribution", () => {
    it(
        "discharge outcomes match the configured weights within tolerance",
        { timeout: 30_000 },
        () => {
            const config = cfg({
                seed: 99,
                resources: { beds: 200, doctors: 50, nurses: 80 },
                arrivals: { meanInterArrivalMs: MS_PER_DAY / 50 },
                bedManager: noCancellations,
            });
            const sim = createWardSimulation(config);
            const tally = { good: 0, complication: 0, poor: 0 };
            sim.subscribe((e) => {
                if (e.kind === "PatientDischarged") {
                    tally[e.outcome] += 1;
                }
            });
            sim.start();
            sim.run(24_000);

            const total = tally.good + tally.complication + tally.poor;
            expect(total).toBeGreaterThan(3000);
            const tol = 0.03;
            expect(tally.good / total).toBeCloseTo(0.7, 1);
            expect(Math.abs(tally.good / total - 0.7)).toBeLessThan(tol);
            expect(Math.abs(tally.complication / total - 0.2)).toBeLessThan(
                tol,
            );
            expect(Math.abs(tally.poor / total - 0.1)).toBeLessThan(tol);
        },
    );
});
