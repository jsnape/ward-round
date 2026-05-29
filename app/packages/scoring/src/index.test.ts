import { describe, expect, it } from "vitest";
import { SCORING_VERSION } from "./index.js";

describe("scoring skeleton", () => {
    it("exposes a version anchor", () => {
        expect(SCORING_VERSION).toBe("0.0.0");
    });
});
