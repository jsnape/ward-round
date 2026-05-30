/**
 * Pure treatment math: treatment duration and the three-tier outcome roll.
 * No scheduling, no emission, no state — just `(inputs) => result`.
 *
 * Treatment gating (whether a new treatment can start) lives in
 * `model/staffing.ts`. Duration is a direct catalog lookup; the throughput
 * multiplier from Stage 1 has been removed.
 */
import { type Rng, weightedPick } from "../rng/rng.js";
import type { OutcomeWeights, RecoveryConfig } from "../config/types.js";
import { type OutcomeTier, OUTCOME_TIERS } from "../state/patient.js";
import { type ProcedureId, getProcedure } from "../config/procedures.js";

/** Expected treatment duration (ms) for the given procedure. */
export function treatmentDuration(procedureId: ProcedureId): number {
    return getProcedure(procedureId).baseDurationMs;
}

/**
 * Adjusts outcome weights based on procedure complexity. Minor procedures
 * improve the good rate by 0.05 at the expense of complications.
 */
export function procedureOutcomeWeights(
    procedureId: ProcedureId,
    base: OutcomeWeights,
): OutcomeWeights {
    const proc = getProcedure(procedureId);
    if (proc.complexity === "major") {
        return base;
    }
    return {
        good: base.good + 0.05,
        complication: base.complication - 0.05,
        poor: base.poor,
    };
}

/** Rolls a stochastic outcome tier from the configured weights. */
export function rollOutcome(weights: OutcomeWeights, rng: Rng): OutcomeTier {
    const w = OUTCOME_TIERS.map((tier) => weights[tier]);
    return OUTCOME_TIERS[weightedPick(w, rng)]!;
}

/**
 * Extra time a patient occupies a bed after treatment, by outcome. `good` means
 * well immediately (0); a patient who is not well cannot be discharged yet.
 */
export function recoveryTime(
    outcome: OutcomeTier,
    recovery: RecoveryConfig,
): number {
    switch (outcome) {
        case "good":
            return 0;
        case "complication":
            return recovery.complicationMs;
        case "poor":
            return recovery.poorMs;
    }
}
