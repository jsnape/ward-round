import { describe, expect, it } from "vitest";
import {
    type PatientView,
    type WorldStateReadModel,
    MS_PER_DAY,
    PatientState,
} from "@ward-round/engine";
import { type ScoringConfig, scoreState } from "./score.js";

const config: ScoringConfig = {
    budget: 1000,
    paymentPerDischarge: 100,
    outcomeScore: { good: 2, complication: 0, poor: -1 },
    dailyDoctorCost: 500,
    dailyNurseCost: 200,
    dailyBedCost: 50,
};

function model(
    patients: PatientView[],
    opts: { simTime?: number; doctors?: number; nurses?: number; beds?: number } = {},
): WorldStateReadModel {
    return {
        simTime: opts.simTime ?? 0,
        beds: {
            capacity: opts.beds ?? 10,
            occupied: 0,
            free: opts.beds ?? 10,
        },
        doctors: opts.doctors ?? 3,
        nurses: opts.nurses ?? 5,
        waitingListLength: 0,
        inTreatmentCount: 0,
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
    procedureId: "appendectomy",
    registeredAt: 0,
    ...(outcome === undefined ? {} : { outcome }),
});

describe("scoreState", () => {
    it("scores zero for an empty ward with no time elapsed", () => {
        expect(scoreState(model([]), config)).toEqual({
            patientsTreated: 0,
            staffCostToDate: 0,
            spent: 0,
            remaining: 1000,
            outcomeScore: 0,
            totalScore: 0,
        });
    });

    it("earns income per discharge and sums tier contributions", () => {
        const score = scoreState(
            model([
                discharged("p-1", "good"),
                discharged("p-2", "complication"),
                discharged("p-3", "poor"),
            ]),
            config,
        );
        expect(score.patientsTreated).toBe(3);
        // At simTime=0, no staff cost accrued; discharge income = 300
        expect(score.staffCostToDate).toBe(0);
        expect(score.spent).toBe(0);
        expect(score.remaining).toBe(1300); // 1000 + 300 income
        expect(score.outcomeScore).toBe(1); // 2 + 0 + -1
        expect(score.totalScore).toBe(4); // 3 treated + 1 quality
    });

    it("does not count cancellations or in-flight patients as income", () => {
        const score = scoreState(
            model([
                {
                    id: "c",
                    state: PatientState.Cancelled,
                    urgency: "routine",
                    procedureId: "appendectomy",
                    registeredAt: 0,
                },
                {
                    id: "t",
                    state: PatientState.InTreatment,
                    urgency: "urgent",
                    procedureId: "hip_replacement",
                    registeredAt: 0,
                },
                discharged("d", "good"),
            ]),
            config,
        );
        expect(score.patientsTreated).toBe(1);
        expect(score.remaining).toBe(1100); // 1000 + 1*100
    });

    it("accrues staff salary over elapsed sim-days", () => {
        // 3 doctors × 500 + 5 nurses × 200 + 10 beds × 50 = 1500 + 1000 + 500 = 3000/day
        const score = scoreState(model([], { simTime: 2 * MS_PER_DAY }), config);
        expect(score.staffCostToDate).toBe(6000); // 3000 × 2 days
        expect(score.spent).toBe(6000);
        expect(score.remaining).toBe(1000 - 6000); // budget - costs (no income yet)
    });

    it("returns zero staff cost when there are no staff or beds", () => {
        const score = scoreState(
            model([], { simTime: 10 * MS_PER_DAY, doctors: 0, nurses: 0, beds: 0 }),
            config,
        );
        expect(score.staffCostToDate).toBe(0);
        expect(score.remaining).toBe(1000);
    });

    it("bed cost contributes independently of staff headcount", () => {
        // 0 doctors, 0 nurses, 5 beds × 50/day = 250/day
        const score = scoreState(
            model([], { simTime: MS_PER_DAY, doctors: 0, nurses: 0, beds: 5 }),
            config,
        );
        expect(score.staffCostToDate).toBe(250);
    });

    it("uses the default config when none is given", () => {
        expect(scoreState(model([])).remaining).toBe(60_000);
    });
});
