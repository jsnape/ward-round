import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG, MS_PER_DAY } from "./defaults.js";
import { OUTCOME_TIERS } from "../state/patient.js";

describe("DEFAULT_ENGINE_CONFIG", () => {
    it("uses the agreed staffing floors and soft bonus", () => {
        expect(DEFAULT_ENGINE_CONFIG.staffing).toEqual({
            minDoctors: 1,
            minNurses: 1,
            softBonusPerExtra: 0.1,
        });
    });

    it("uses the agreed outcome weights (0.70 / 0.20 / 0.10)", () => {
        expect(DEFAULT_ENGINE_CONFIG.outcomeWeights).toEqual({
            good: 0.7,
            complication: 0.2,
            poor: 0.1,
        });
    });

    it("expresses duration classes as 1/3/7 days in ms", () => {
        expect(DEFAULT_ENGINE_CONFIG.baseDurationMs).toEqual({
            short: MS_PER_DAY,
            medium: 3 * MS_PER_DAY,
            long: 7 * MS_PER_DAY,
        });
    });

    it("covers every outcome tier with a weight", () => {
        for (const tier of OUTCOME_TIERS) {
            expect(DEFAULT_ENGINE_CONFIG.outcomeWeights[tier]).toBeGreaterThan(
                0,
            );
        }
    });
});
