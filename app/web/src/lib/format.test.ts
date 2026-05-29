import { describe, expect, it } from "vitest";
import { formatSimTime } from "./format.js";

describe("formatSimTime", () => {
    it("formats the game epoch as day zero", () => {
        expect(formatSimTime(0)).toBe("Day 0 00:00");
    });

    it("formats hours and minutes within a day", () => {
        const ms = (3 * 60 + 7) * 60_000; // 03:07
        expect(formatSimTime(ms)).toBe("Day 0 03:07");
    });

    it("rolls over into whole days", () => {
        const ms = (2 * 24 * 60 + 30) * 60_000; // day 2, 00:30
        expect(formatSimTime(ms)).toBe("Day 2 00:30");
    });

    it("rejects negative time", () => {
        expect(() => formatSimTime(-1)).toThrow(RangeError);
    });

    it("rejects non-finite time", () => {
        expect(() => formatSimTime(Number.NaN)).toThrow(RangeError);
    });
});
