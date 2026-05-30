import { describe, expect, it } from "vitest";
import type { ResourceState } from "../state/resources.js";
import {
    canAddBed,
    canStartTreatment,
    freeStaff,
    wardNursesNeeded,
} from "./staffing.js";

function res(
    beds: number,
    doctors: number,
    nurses: number,
    occupied = 0,
): ResourceState {
    return {
        beds: { capacity: beds, occupied },
        doctors: { headcount: doctors },
        nurses: { headcount: nurses },
    };
}

describe("wardNursesNeeded", () => {
    it("returns ceil(bedCapacity * acuity)", () => {
        expect(wardNursesNeeded(8, 0.5)).toBe(4);
        expect(wardNursesNeeded(9, 0.5)).toBe(5); // ceil rounds up
        expect(wardNursesNeeded(0, 0.5)).toBe(0);
    });

    it("returns 0 when acuity is 0", () => {
        expect(wardNursesNeeded(10, 0)).toBe(0);
    });
});

describe("freeStaff", () => {
    it("returns full headcount as free when no treatments are running", () => {
        // wardNurses = ceil(8 * 0.5) = 4; freeNurses = 6 - 4 - 0 = 2
        expect(freeStaff(res(8, 3, 6), 0, 0.5)).toEqual({
            freeDoctors: 3,
            freeNurses: 2,
        });
    });

    it("subtracts in-treatment count from both doctors and nurses", () => {
        // freeDoctors = 3 - 2 = 1; freeNurses = max(0, 6 - 4 - 2) = 0
        expect(freeStaff(res(8, 3, 6), 2, 0.5)).toEqual({
            freeDoctors: 1,
            freeNurses: 0,
        });
    });

    it("clamps freeNurses at 0 when ward coverage consumes all nurses", () => {
        // wardNurses = 4; nurses = 4; freeNurses = max(0, 4 - 4 - 0) = 0
        expect(freeStaff(res(8, 3, 4), 0, 0.5)).toEqual({
            freeDoctors: 3,
            freeNurses: 0,
        });
    });

    it("returns negative freeDoctors when in-treatment count exceeds headcount", () => {
        // In-flight treatments are never cancelled; freeDoctors can go negative
        const result = freeStaff(res(8, 1, 6), 3, 0.5);
        expect(result.freeDoctors).toBe(-2);
    });
});

describe("canStartTreatment", () => {
    it("returns true when both a free doctor and a free nurse are available", () => {
        expect(canStartTreatment(1, 1)).toBe(true);
        expect(canStartTreatment(5, 3)).toBe(true);
    });

    it("returns false when there are no free doctors", () => {
        expect(canStartTreatment(0, 1)).toBe(false);
    });

    it("returns false when there are no free nurses", () => {
        expect(canStartTreatment(1, 0)).toBe(false);
    });

    it("returns false when both are zero", () => {
        expect(canStartTreatment(0, 0)).toBe(false);
    });
});

describe("canAddBed", () => {
    it("allows adding a bed when nurses can cover the new acuity load", () => {
        // 8 + 1 = 9 beds; ceil(9 * 0.5) = 5; nurses = 5 >= 5
        expect(canAddBed(8, 5, 0.5)).toBe(true);
    });

    it("blocks adding a bed when nurses cannot cover the new acuity load", () => {
        // 8 + 1 = 9 beds; ceil(9 * 0.5) = 5; nurses = 4 < 5
        expect(canAddBed(8, 4, 0.5)).toBe(false);
    });

    it("always allows adding a bed when acuity is 0", () => {
        expect(canAddBed(100, 0, 0)).toBe(true);
    });
});
