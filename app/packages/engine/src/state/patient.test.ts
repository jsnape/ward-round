import { describe, expect, it } from "vitest";
import {
    type Patient,
    OUTCOME_TIERS,
    PatientState,
    URGENCIES,
    createPatient,
} from "./patient.js";

describe("patient vocabulary", () => {
    it("orders outcome tiers best to worst", () => {
        expect(OUTCOME_TIERS).toEqual(["good", "complication", "poor"]);
    });

    it("lists urgency classes", () => {
        expect(URGENCIES).toEqual(["routine", "urgent", "emergency"]);
    });
});

describe("createPatient", () => {
    it("places a new patient on the waiting list with no later timestamps", () => {
        const patient: Patient = createPatient({
            id: "p-1",
            urgency: "routine",
            procedureId: "colonoscopy",
            registeredAt: 1000,
        });
        expect(patient).toEqual({
            id: "p-1",
            state: PatientState.WaitingList,
            urgency: "routine",
            procedureId: "colonoscopy",
            registeredAt: 1000,
        });
        expect(patient.scheduledAt).toBeUndefined();
        expect(patient.outcome).toBeUndefined();
    });
});
