import { describe, expect, it } from "vitest";
import type { Rng } from "../rng/rng.js";
import {
    PROCEDURE_IDS,
    drawProcedure,
    getProcedure,
    type ProcedureId,
} from "./procedures.js";

class ScriptedRng implements Rng {
    private i = 0;
    constructor(private readonly values: readonly number[]) {}
    next(): number {
        return this.values[this.i++ % this.values.length]!;
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

describe("getProcedure", () => {
    it.each(PROCEDURE_IDS)("returns the definition for %s", (id) => {
        const proc = getProcedure(id);
        expect(proc.id).toBe(id);
        expect(proc.baseDurationMs).toBeGreaterThan(0);
    });

    it("throws RangeError for an unknown id", () => {
        expect(() => getProcedure("unknown" as ProcedureId)).toThrow(RangeError);
    });
});

describe("drawProcedure", () => {
    it("only returns routine-eligible procedures for routine urgency", () => {
        const results = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const rng = new ScriptedRng([i / 100]);
            results.add(drawProcedure("routine", rng));
        }
        expect(results.has("appendectomy")).toBe(false);
        expect(results.has("cardiac_stent")).toBe(false);
    });

    it("only returns emergency-eligible procedures for emergency urgency", () => {
        const results = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const rng = new ScriptedRng([i / 100]);
            results.add(drawProcedure("emergency", rng));
        }
        for (const id of results) {
            expect(["appendectomy", "cholecystectomy", "cardiac_stent"]).toContain(id);
        }
    });
});
