import { describe, expect, it } from "vitest";
import {
    type PatientView,
    type WorldStateReadModel,
    PatientState,
} from "@ward-round/engine";
import { type ScoringConfig, scoreState } from "./score.js";

const config: ScoringConfig = {
    budget: 1000,
    paymentPerDischarge: 100,
    outcomeScore: { good: 2, complication: 0, poor: -1 },
};

function model(patients: PatientView[]): WorldStateReadModel {
    return {
        simTime: 0,
        beds: { capacity: 10, occupied: 0, free: 10 },
        doctors: 3,
        nurses: 5,
        waitingListLength: 0,
        patients,
        counters: { registered: 0, admitted: 0, discharged: 0, cancelled: 0 },
    };
}

const discharged = (
    id: string,
    outcome: PatientView["outcome"],
): PatientView => ({
    id,
    state: PatientState.Discharged,
    urgency: "routine",
    durationClass: "short",
    ...(outcome === undefined ? {} : { outcome }),
});

describe("scoreState", () => {
    it("scores zero for an empty ward", () => {
        expect(scoreState(model([]), config)).toEqual({
            patientsTreated: 0,
            spent: 0,
            remaining: 1000,
            outcomeScore: 0,
            totalScore: 0,
        });
    });

    it("pays per discharge and sums tier contributions", () => {
        const score = scoreState(
            model([
                discharged("p-1", "good"),
                discharged("p-2", "complication"),
                discharged("p-3", "poor"),
            ]),
            config,
        );
        expect(score.patientsTreated).toBe(3);
        expect(score.spent).toBe(300);
        expect(score.remaining).toBe(700);
        expect(score.outcomeScore).toBe(1); // 2 + 0 + -1
        expect(score.totalScore).toBe(4); // 3 treated + 1 quality
    });

    it("does not pay for cancellations or in-flight patients", () => {
        const score = scoreState(
            model([
                {
                    id: "c",
                    state: PatientState.Cancelled,
                    urgency: "routine",
                    durationClass: "short",
                },
                {
                    id: "t",
                    state: PatientState.InTreatment,
                    urgency: "urgent",
                    durationClass: "long",
                },
                discharged("d", "good"),
            ]),
            config,
        );
        expect(score.patientsTreated).toBe(1);
        expect(score.spent).toBe(100);
    });

    it("uses the default config when none is given", () => {
        expect(scoreState(model([])).remaining).toBe(1_000_000);
    });
});
