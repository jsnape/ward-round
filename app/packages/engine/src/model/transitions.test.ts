import { describe, expect, it } from "vitest";
import { PatientState, createPatient } from "../state/patient.js";
import { assertTransition, canTransition, transition } from "./transitions.js";

const S = PatientState;

const LEGAL: ReadonlyArray<[PatientState, PatientState]> = [
    [S.WaitingList, S.Scheduled],
    [S.Scheduled, S.Admitted],
    [S.Scheduled, S.Cancelled],
    [S.Admitted, S.InTreatment],
    [S.Admitted, S.Cancelled],
    [S.InTreatment, S.ReadyForDischarge],
    [S.ReadyForDischarge, S.Discharged],
];

const ILLEGAL: ReadonlyArray<[PatientState, PatientState]> = [
    [S.WaitingList, S.Admitted],
    [S.WaitingList, S.Discharged],
    [S.Scheduled, S.InTreatment],
    [S.InTreatment, S.Discharged],
    [S.Discharged, S.WaitingList],
    [S.Cancelled, S.Scheduled],
];

describe("canTransition", () => {
    it("accepts every legal transition", () => {
        for (const [from, to] of LEGAL) {
            expect(canTransition(from, to)).toBe(true);
        }
    });

    it("rejects illegal transitions, including out of terminal states", () => {
        for (const [from, to] of ILLEGAL) {
            expect(canTransition(from, to)).toBe(false);
        }
    });
});

describe("assertTransition", () => {
    it("passes for a legal transition", () => {
        expect(() =>
            assertTransition(S.WaitingList, S.Scheduled),
        ).not.toThrow();
    });

    it("throws for an illegal transition", () => {
        expect(() => assertTransition(S.WaitingList, S.Discharged)).toThrow(
            /illegal patient transition/,
        );
    });
});

describe("transition", () => {
    it("mutates the patient's state when legal", () => {
        const patient = createPatient({
            id: "p-1",
            urgency: "routine",
            durationClass: "short",
            registeredAt: 0,
        });
        transition(patient, S.Scheduled);
        expect(patient.state).toBe(S.Scheduled);
    });

    it("throws and leaves state unchanged when illegal", () => {
        const patient = createPatient({
            id: "p-1",
            urgency: "routine",
            durationClass: "short",
            registeredAt: 0,
        });
        expect(() => transition(patient, S.Discharged)).toThrow();
        expect(patient.state).toBe(S.WaitingList);
    });
});
