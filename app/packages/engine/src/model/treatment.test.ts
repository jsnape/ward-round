import { describe, expect, it } from "vitest";
import type { Rng } from "../rng/rng.js";
import type { DurationConfig, StaffingConfig } from "../config/types.js";
import {
    isStaffed,
    recoveryTime,
    rollOutcome,
    throughputMultiplier,
    treatmentDuration,
} from "./treatment.js";

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

const staffing: StaffingConfig = {
    minDoctors: 1,
    minNurses: 1,
    softBonusPerExtra: 0.1,
};
const base: DurationConfig = { short: 100, medium: 300, long: 700 };

describe("throughputMultiplier", () => {
    it("is 0 below the doctor floor", () => {
        expect(throughputMultiplier(0, 5, staffing)).toBe(0);
    });

    it("is 0 below the nurse floor", () => {
        expect(throughputMultiplier(2, 0, staffing)).toBe(0);
    });

    it("is exactly 1 at the floor (no extra staff)", () => {
        expect(throughputMultiplier(1, 1, staffing)).toBe(1);
    });

    it("adds a soft bonus per staff member above the floor", () => {
        // extra = (3-1) + (5-1) = 6 ; 1 + 0.1*6 = 1.6
        expect(throughputMultiplier(3, 5, staffing)).toBeCloseTo(1.6, 10);
    });
});

describe("isStaffed", () => {
    it("is true at or above the floor", () => {
        expect(isStaffed(1, 1, staffing)).toBe(true);
    });

    it("is false below the floor", () => {
        expect(isStaffed(0, 1, staffing)).toBe(false);
    });
});

describe("treatmentDuration", () => {
    it("returns the base duration at the floor (multiplier 1)", () => {
        expect(treatmentDuration("short", 1, 1, staffing, base)).toBe(100);
    });

    it("shortens duration as throughput rises", () => {
        // 100 / 1.6 = 62.5 -> 63
        expect(treatmentDuration("short", 3, 5, staffing, base)).toBe(63);
    });

    it("throws when understaffed", () => {
        expect(() => treatmentDuration("short", 0, 1, staffing, base)).toThrow(
            RangeError,
        );
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
