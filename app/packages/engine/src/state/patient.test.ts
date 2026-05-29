import { describe, expect, it } from "vitest";
import {
    type Patient,
    DURATION_CLASSES,
    OUTCOME_TIERS,
    PatientState,
    URGENCIES,
    createPatient,
} from "./patient.js";

describe("patient vocabulary", () => {
    it("orders outcome tiers best to worst", () => {
        expect(OUTCOME_TIERS).toEqual(["good", "complication", "poor"]);
    });

    it("lists urgency and duration classes", () => {
        expect(URGENCIES).toEqual(["routine", "urgent", "emergency"]);
        expect(DURATION_CLASSES).toEqual(["short", "medium", "long"]);
    });
});

describe("createPatient", () => {
    it("places a new patient on the waiting list with no later timestamps", () => {
        const patient: Patient = createPatient({
            id: "p-1",
            urgency: "routine",
            durationClass: "medium",
            registeredAt: 1000,
        });
        expect(patient).toEqual({
            id: "p-1",
            state: PatientState.WaitingList,
            urgency: "routine",
            durationClass: "medium",
            registeredAt: 1000,
        });
        expect(patient.scheduledAt).toBeUndefined();
        expect(patient.outcome).toBeUndefined();
    });
});
