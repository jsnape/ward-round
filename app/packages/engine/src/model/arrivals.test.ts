import { describe, expect, it } from "vitest";
import { type Rng, createRng } from "../rng/rng.js";
import type { ArrivalConfig } from "../config/types.js";
import { drawUrgency, nextInterArrival } from "./arrivals.js";

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

const cfg: ArrivalConfig = {
    meanInterArrivalMs: 1000,
    urgencyWeights: { routine: 0.6, urgent: 0.3, emergency: 0.1 },
};

describe("nextInterArrival", () => {
    it("floors a zero draw at 1ms", () => {
        // -mean * ln(1 - 0) = 0 -> max(1, 0) = 1
        expect(nextInterArrival(1000, new ScriptedRng([0]))).toBe(1);
    });

    it("samples the exponential gap for a mid draw", () => {
        // -1000 * ln(1 - 0.5) = 693.147 -> 693
        expect(nextInterArrival(1000, new ScriptedRng([0.5]))).toBe(693);
    });

    it("is deterministic for a given seed", () => {
        expect(nextInterArrival(1000, createRng(9))).toBe(
            nextInterArrival(1000, createRng(9)),
        );
    });

    it("throws on a non-positive mean", () => {
        expect(() => nextInterArrival(0, new ScriptedRng([0.5]))).toThrow(
            RangeError,
        );
    });
});

describe("drawUrgency", () => {
    it("selects the urgency bucket the draw falls into", () => {
        expect(drawUrgency(cfg, new ScriptedRng([0]))).toBe("routine");
        expect(drawUrgency(cfg, new ScriptedRng([0.7]))).toBe("urgent");
        expect(drawUrgency(cfg, new ScriptedRng([0.95]))).toBe("emergency");
    });
});

