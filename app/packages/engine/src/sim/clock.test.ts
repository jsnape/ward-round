import { describe, expect, it } from "vitest";
import { SimClock } from "./clock.js";

describe("SimClock", () => {
    it("starts at the epoch", () => {
        expect(new SimClock().simTime).toBe(0);
    });

    it("advances forward", () => {
        const clock = new SimClock();
        clock.advanceTo(100);
        expect(clock.simTime).toBe(100);
        clock.advanceTo(250);
        expect(clock.simTime).toBe(250);
    });

    it("allows advancing to the same time", () => {
        const clock = new SimClock();
        clock.advanceTo(100);
        clock.advanceTo(100);
        expect(clock.simTime).toBe(100);
    });

    it("rejects going backwards", () => {
        const clock = new SimClock();
        clock.advanceTo(100);
        expect(() => clock.advanceTo(99)).toThrow(RangeError);
    });

    it("rejects a non-integer time", () => {
        expect(() => new SimClock().advanceTo(1.5)).toThrow(RangeError);
    });
});
