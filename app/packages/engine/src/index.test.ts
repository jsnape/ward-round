import { describe, expect, it } from "vitest";
import {
    DEFAULT_ENGINE_CONFIG,
    ENGINE_VERSION,
    PatientState,
    createSimulation,
} from "./index.js";

describe("engine public barrel", () => {
    it("exposes a version anchor", () => {
        expect(ENGINE_VERSION).toBe("0.0.0");
    });

    it("re-exports the construction entry point and config", () => {
        const sim = createSimulation(DEFAULT_ENGINE_CONFIG);
        expect(sim.simTime).toBe(0);
    });

    it("re-exports the patient state enum", () => {
        expect(PatientState.WaitingList).toBe("WaitingList");
    });
});
