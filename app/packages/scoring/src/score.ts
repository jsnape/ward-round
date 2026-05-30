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
    PatientState,
} from "@ward-round/engine";

export interface ScoringConfig {
    /** Starting budget (funds available to run the ward). */
    budget: number;
    /** Amount drawn from budget per treated (discharged) patient. */
    paymentPerDischarge: number;
    /** Score contribution per outcome tier. */
    outcomeScore: Record<OutcomeTier, number>;
}

export interface Score {
    patientsTreated: number;
    spent: number;
    remaining: number;
    outcomeScore: number;
    /** Combined objective: throughput + outcome quality. */
    totalScore: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
    budget: 1_000_000,
    paymentPerDischarge: 1000,
    outcomeScore: { good: 2, complication: 0, poor: -1 },
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
    const spent = patientsTreated * config.paymentPerDischarge;
    return {
        patientsTreated,
        spent,
        remaining: config.budget - spent,
        outcomeScore,
        totalScore: patientsTreated + outcomeScore,
    };
}
