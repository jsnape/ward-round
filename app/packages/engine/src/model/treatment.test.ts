import { describe, expect, it } from "vitest";
import type { Rng } from "../rng/rng.js";
import {
    procedureOutcomeWeights,
    recoveryTime,
    rollOutcome,
    treatmentDuration,
} from "./treatment.js";
import { MS_PER_DAY } from "../config/defaults.js";

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

describe("treatmentDuration", () => {
    it("returns the procedure's baseDurationMs from the catalog", () => {
        expect(treatmentDuration("appendectomy")).toBe(1 * MS_PER_DAY);
        expect(treatmentDuration("cholecystectomy")).toBe(2 * MS_PER_DAY);
        expect(treatmentDuration("hip_replacement")).toBe(7 * MS_PER_DAY);
    });
});

describe("procedureOutcomeWeights", () => {
    const base = { good: 0.7, complication: 0.2, poor: 0.1 };

    it("improves good rate and reduces complication for a minor procedure", () => {
        const result = procedureOutcomeWeights("colonoscopy", base);
        expect(result.good).toBeCloseTo(0.75);
        expect(result.complication).toBeCloseTo(0.15);
        expect(result.poor).toBeCloseTo(0.1);
    });

    it("returns base weights unchanged for a major procedure", () => {
        const result = procedureOutcomeWeights("hip_replacement", base);
        expect(result).toBe(base);
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
