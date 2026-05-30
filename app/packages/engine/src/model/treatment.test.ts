import { describe, expect, it } from "vitest";
import type { Rng } from "../rng/rng.js";
import type { DurationConfig } from "../config/types.js";
import { recoveryTime, rollOutcome, treatmentDuration } from "./treatment.js";

class ScriptedRng implements Rng {
    private i = 0;
    constructor(private readonly values: readonly number[]) {}
    next(): number {
        return this.values[this.i++]!;
    }
    int(): number {
        throw new Error("not used");
    }
    fork(): Rng {
        throw new Error("not used");
    }
    getState(): number {
        throw new Error("not used");
    }
    setState(): void {
        throw new Error("not used");
    }
}

const base: DurationConfig = { short: 100, medium: 300, long: 700 };

describe("treatmentDuration", () => {
    it("returns the configured base duration for each class", () => {
        expect(treatmentDuration("short", base)).toBe(100);
        expect(treatmentDuration("medium", base)).toBe(300);
        expect(treatmentDuration("long", base)).toBe(700);
    });
});

describe("rollOutcome", () => {
    const weights = { good: 0.7, complication: 0.2, poor: 0.1 };

    it("lands in each tier by where the draw falls", () => {
        expect(rollOutcome(weights, new ScriptedRng([0]))).toBe("good");
        expect(rollOutcome(weights, new ScriptedRng([0.8]))).toBe(
            "complication",
        );
        expect(rollOutcome(weights, new ScriptedRng([0.95]))).toBe("poor");
    });
});

describe("recoveryTime", () => {
    const recovery = { complicationMs: 200, poorMs: 500 };

    it("is zero for a good outcome (well immediately)", () => {
        expect(recoveryTime("good", recovery)).toBe(0);
    });

    it("extends a bed stay for a complication", () => {
        expect(recoveryTime("complication", recovery)).toBe(200);
    });

    it("extends a bed stay further for a poor outcome", () => {
        expect(recoveryTime("poor", recovery)).toBe(500);
    });
});
