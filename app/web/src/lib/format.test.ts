import { describe, expect, it } from "vitest";
import { formatSimTime, formatWaitDays, formatProgress } from "./format.js";

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

describe("formatWaitDays", () => {
    it("returns 0h when there is no wait", () => {
        expect(formatWaitDays(1000, 1000)).toBe("0h");
    });

    it("clamps negative durations to 0h", () => {
        expect(formatWaitDays(5000, 0)).toBe("0h");
    });

    it("formats a sub-day wait as hours only", () => {
        expect(formatWaitDays(0, 6 * MS_PER_HOUR)).toBe("6h");
    });

    it("formats a multi-day wait as days and hours", () => {
        expect(formatWaitDays(0, 3 * MS_PER_DAY + 4 * MS_PER_HOUR)).toBe("3d 4h");
    });

    it("formats exactly one day with zero hours", () => {
        expect(formatWaitDays(0, MS_PER_DAY)).toBe("1d 0h");
    });
});

describe("formatProgress", () => {
    it("returns 0 for a degenerate interval (endAt <= startAt)", () => {
        expect(formatProgress(100, 100, 50)).toBe(0);
        expect(formatProgress(100, 50, 75)).toBe(0);
    });

    it("returns 0 at the start of the interval", () => {
        expect(formatProgress(0, 1000, 0)).toBe(0);
    });

    it("returns 50 at the midpoint", () => {
        expect(formatProgress(0, 1000, 500)).toBe(50);
    });

    it("returns 100 at the end", () => {
        expect(formatProgress(0, 1000, 1000)).toBe(100);
    });

    it("clamps to 100 when past the end", () => {
        expect(formatProgress(0, 1000, 1500)).toBe(100);
    });

    it("clamps to 0 when before the start", () => {
        expect(formatProgress(500, 1000, 100)).toBe(0);
    });
});
