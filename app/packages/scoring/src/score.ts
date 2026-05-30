/**
 * NHS-mode scoring: a pure read-layer over the engine's `WorldStateReadModel`.
 * The engine knows nothing of this. Payment is per discharge only — cancelled
 * patients (no outcome) earn nothing. The score blends throughput (patients
 * treated) with outcome quality.
 *
 * The numbers in `DEFAULT_SCORING_CONFIG` are placeholders for play-tuning.
 */
import {
    type OutcomeTier,
    type WorldStateReadModel,
    MS_PER_DAY,
    PatientState,
} from "@ward-round/engine";

export interface ScoringConfig {
    /** Starting budget (cash available to run the ward). */
    budget: number;
    /** Income received per treated (discharged) patient. */
    paymentPerDischarge: number;
    /** Score contribution per outcome tier. */
    outcomeScore: Record<OutcomeTier, number>;
    /** Daily salary cost per doctor. */
    dailyDoctorCost: number;
    /** Daily salary cost per nurse. */
    dailyNurseCost: number;
    /** Daily running cost per open bed. */
    dailyBedCost: number;
}

export interface Score {
    patientsTreated: number;
    /** Running staff + bed cost accrued so far. */
    staffCostToDate: number;
    /** Alias for staffCostToDate — what has been paid out. */
    spent: number;
    /** budget + discharge income − staff costs. */
    remaining: number;
    outcomeScore: number;
    /** Combined objective: throughput + outcome quality. */
    totalScore: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
    budget: 60_000,
    paymentPerDischarge: 2_500,
    outcomeScore: { good: 2, complication: 0, poor: -1 },
    dailyDoctorCost: 500,
    dailyNurseCost: 200,
    dailyBedCost: 50,
};

/** Computes the score from a world read-model. Pure; no engine instance needed. */
export function scoreState(
    state: WorldStateReadModel,
    config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): Score {
    let patientsTreated = 0;
    let outcomeScore = 0;
    for (const patient of state.patients) {
        if (
            patient.state === PatientState.Discharged &&
            patient.outcome !== undefined
        ) {
            patientsTreated += 1;
            outcomeScore += config.outcomeScore[patient.outcome];
        }
    }
    const simDays = state.simTime / MS_PER_DAY;
    const staffCostToDate = Math.round(
        simDays *
            (state.doctors * config.dailyDoctorCost +
                state.nurses * config.dailyNurseCost +
                state.beds.capacity * config.dailyBedCost),
    );
    const dischargeIncome = patientsTreated * config.paymentPerDischarge;
    const spent = staffCostToDate;
    const remaining = config.budget + dischargeIncome - staffCostToDate;
    return {
        patientsTreated,
        staffCostToDate,
        spent,
        remaining,
        outcomeScore,
        totalScore: patientsTreated + outcomeScore,
    };
}
