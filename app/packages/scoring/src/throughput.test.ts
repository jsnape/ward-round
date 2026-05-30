import { describe, expect, it } from "vitest";
import { MS_PER_DAY } from "@ward-round/engine";
import { computeThroughputRate } from "./throughput.js";

describe("computeThroughputRate", () => {
    it("returns 0 when simTime is zero", () => {
        expect(computeThroughputRate(10, 0)).toBe(0);
    });

    it("returns 0 when simTime is negative", () => {
        expect(computeThroughputRate(5, -1)).toBe(0);
    });

    it("returns discharges per day for exactly one day elapsed", () => {
        expect(computeThroughputRate(3, MS_PER_DAY)).toBe(3);
    });

    it("scales correctly over multiple days", () => {
        expect(computeThroughputRate(10, 5 * MS_PER_DAY)).toBe(2);
    });

    it("returns zero discharges as zero rate regardless of elapsed time", () => {
        expect(computeThroughputRate(0, 10 * MS_PER_DAY)).toBe(0);
    });
});
