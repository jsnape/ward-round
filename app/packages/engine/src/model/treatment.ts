/**
 * Pure treatment math: the staffing → throughput coupling, treatment duration,
 * and the three-tier outcome roll. No scheduling, no emission, no state — just
 * `(inputs) => result`, which is what makes 100% branch coverage cheap.
 */
import { type Rng, weightedPick } from "../rng/rng.js";
import type {
    DurationConfig,
    OutcomeWeights,
    RecoveryConfig,
    StaffingConfig,
} from "../config/types.js";
import {
    type DurationClass,
    type OutcomeTier,
    OUTCOME_TIERS,
} from "../state/patient.js";

/**
 * Throughput as a function of staffing:
 * - below either floor → 0 (hard floor: treatment stalls);
 * - at or above the floor → 1 + softBonus × (staff above the floor).
 */
export function throughputMultiplier(
    doctors: number,
    nurses: number,
    cfg: StaffingConfig,
): number {
    if (doctors < cfg.minDoctors || nurses < cfg.minNurses) {
        return 0;
    }
    const extra = doctors - cfg.minDoctors + (nurses - cfg.minNurses);
    return 1 + cfg.softBonusPerExtra * extra;
}

/** Whether staffing is sufficient to start/progress treatment. */
export function isStaffed(
    doctors: number,
    nurses: number,
    cfg: StaffingConfig,
): boolean {
    return throughputMultiplier(doctors, nurses, cfg) > 0;
}

/**
 * Expected treatment duration (integer ms): the base duration for the class
 * divided by the throughput multiplier, floored at 1ms. Throws if understaffed
 * (callers must check {@link isStaffed} before starting treatment).
 */
export function treatmentDuration(
    durationClass: DurationClass,
    doctors: number,
    nurses: number,
    staffing: StaffingConfig,
    base: DurationConfig,
): number {
    const mult = throughputMultiplier(doctors, nurses, staffing);
    if (mult <= 0) {
        throw new RangeError(
            "cannot compute treatment duration while understaffed",
        );
    }
    return Math.max(1, Math.round(base[durationClass] / mult));
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
