import { describe, expect, it } from "vitest";
import { type Rng, Mulberry32Rng, createRng, weightedPick } from "./rng.js";

/** A scripted RNG for deterministic tests of code that consumes an Rng. */
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

describe("Mulberry32Rng.next", () => {
    it("produces a fixed golden sequence for a known seed", () => {
        const rng = new Mulberry32Rng(12345);
        expect([rng.next(), rng.next(), rng.next()]).toEqual([
            0.9797282677609473, 0.3067522644996643, 0.484205421525985,
        ]);
    });

    it("is deterministic across instances with the same seed", () => {
        const a = createRng(42);
        const b = createRng(42);
        const seqA = [a.next(), a.next(), a.next(), a.next()];
        const seqB = [b.next(), b.next(), b.next(), b.next()];
        expect(seqA).toEqual(seqB);
    });

    it("returns values in the half-open interval [0, 1)", () => {
        const rng = createRng(7);
        for (let i = 0; i < 1000; i++) {
            const v = rng.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});

describe("Mulberry32Rng.int", () => {
    it("returns 0 when maxExclusive is 1", () => {
        expect(createRng(1).int(1)).toBe(0);
    });

    it("returns integers within [0, maxExclusive)", () => {
        const rng = createRng(99);
        for (let i = 0; i < 1000; i++) {
            const v = rng.int(6);
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(6);
        }
    });

    it("throws on a non-integer bound", () => {
        expect(() => createRng(1).int(2.5)).toThrow(RangeError);
    });

    it("throws on a non-positive bound", () => {
        expect(() => createRng(1).int(0)).toThrow(RangeError);
    });
});

describe("Mulberry32Rng.fork", () => {
    it("derives an independent stream that differs from the parent", () => {
        const parent = new Mulberry32Rng(2024);
        const child = parent.fork("arrivals");
        // Forking does not advance the parent.
        const parentFirst = parent.next();
        const reParent = new Mulberry32Rng(2024).next();
        expect(parentFirst).toBe(reParent);
        // The child stream differs from the parent stream.
        expect(child.next()).not.toBe(parentFirst);
    });

    it("derives distinct streams for distinct labels", () => {
        const parent = new Mulberry32Rng(2024);
        const a = parent.fork("arrivals");
        const b = parent.fork("outcomes");
        expect(a.next()).not.toBe(b.next());
    });

    it("is reproducible for the same label", () => {
        const a = new Mulberry32Rng(2024).fork("arrivals").next();
        const b = new Mulberry32Rng(2024).fork("arrivals").next();
        expect(a).toBe(b);
    });

    it("handles an empty label", () => {
        const child = new Mulberry32Rng(2024).fork("");
        expect(child.next()).toBeGreaterThanOrEqual(0);
    });
});

describe("Mulberry32Rng state", () => {
    it("round-trips via getState/setState", () => {
        const rng = createRng(555);
        rng.next();
        const saved = rng.getState();
        const expected = [rng.next(), rng.next(), rng.next()];
        rng.setState(saved);
        expect([rng.next(), rng.next(), rng.next()]).toEqual(expected);
    });

    it("coerces restored state to a uint32", () => {
        const rng = createRng(1);
        rng.setState(-1);
        expect(rng.getState()).toBe(0xffffffff);
    });
});

describe("weightedPick", () => {
    it("selects the bucket the draw falls into", () => {
        const weights = [0.7, 0.2, 0.1];
        expect(weightedPick(weights, new ScriptedRng([0.0]))).toBe(0);
        expect(weightedPick(weights, new ScriptedRng([0.69]))).toBe(0);
        expect(weightedPick(weights, new ScriptedRng([0.8]))).toBe(1);
        expect(weightedPick(weights, new ScriptedRng([0.95]))).toBe(2);
    });

    it("returns the last bucket when the draw lands exactly at the total", () => {
        // next() === 1 makes r === total, so no bucket strictly contains it.
        expect(weightedPick([0.5, 0.5], new ScriptedRng([1]))).toBe(1);
    });

    it("throws on a negative weight", () => {
        expect(() => weightedPick([0.5, -0.1], new ScriptedRng([0]))).toThrow(
            RangeError,
        );
    });

    it("throws when weights sum to zero", () => {
        expect(() => weightedPick([0, 0], new ScriptedRng([0]))).toThrow(
            RangeError,
        );
    });

    it("throws on empty weights", () => {
        expect(() => weightedPick([], new ScriptedRng([0]))).toThrow(
            RangeError,
        );
    });
});
