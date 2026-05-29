import { describe, expect, it } from "vitest";
import {
    type ResourceState,
    createResourceState,
    freeBeds,
    hasFreeBed,
} from "./resources.js";

describe("createResourceState", () => {
    it("builds pools from config with no beds occupied", () => {
        const state = createResourceState({ beds: 10, doctors: 3, nurses: 5 });
        expect(state).toEqual({
            beds: { capacity: 10, occupied: 0 },
            doctors: { headcount: 3 },
            nurses: { headcount: 5 },
        });
    });
});

describe("bed queries", () => {
    it("reports free beds and availability when space remains", () => {
        const state: ResourceState = {
            beds: { capacity: 10, occupied: 4 },
            doctors: { headcount: 3 },
            nurses: { headcount: 5 },
        };
        expect(freeBeds(state)).toBe(6);
        expect(hasFreeBed(state)).toBe(true);
    });

    it("reports no availability when full", () => {
        const state: ResourceState = {
            beds: { capacity: 2, occupied: 2 },
            doctors: { headcount: 1 },
            nurses: { headcount: 1 },
        };
        expect(freeBeds(state)).toBe(0);
        expect(hasFreeBed(state)).toBe(false);
    });
});
