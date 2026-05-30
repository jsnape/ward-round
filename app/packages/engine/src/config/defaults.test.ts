import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG } from "./defaults.js";
import { OUTCOME_TIERS } from "../state/patient.js";

describe("DEFAULT_ENGINE_CONFIG", () => {
    it("uses the agreed ward acuity (0.5 = 1 nurse per 2 beds)", () => {
        expect(DEFAULT_ENGINE_CONFIG.ward).toEqual({ acuity: 0.5 });
    });

    it("uses the agreed outcome weights (0.70 / 0.20 / 0.10)", () => {
        expect(DEFAULT_ENGINE_CONFIG.outcomeWeights).toEqual({
            good: 0.7,
            complication: 0.2,
            poor: 0.1,
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
