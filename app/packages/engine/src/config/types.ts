/**
 * The engine's configuration surface. Every tunable lives here so that balance
 * questions are data, not code. `seed` is the single origin of all stochasticity.
 */
import type { OutcomeTier, Urgency } from "../state/patient.js";

/** Base outcome-tier probabilities for a treatment (need not sum to 1). */
export type OutcomeWeights = Record<OutcomeTier, number>;

/**
 * Extra recovery time (ms) a patient occupies a bed *after* treatment completes,
 * by outcome. A `good` outcome means well immediately (0); `complication` and
 * `poor` patients are not yet well and cannot go home until recovered.
 */
export interface RecoveryConfig {
    complicationMs: number;
    poorMs: number;
}

/**
 * Ward clinical environment. Acuity is the minimum nurse-to-bed ratio: the
 * number of nurses permanently consumed by ward-coverage duties per open bed.
 * Beds cannot be added unless nurse headcount covers the new acuity load.
 */
export interface WardConfig {
    /** Nurses required per bed (e.g. 0.5 for general medicine = 1 per 2 beds). */
    acuity: number;
}

/** The arrival process and the attribute mix of arriving patients. */
export interface ArrivalConfig {
    /** Mean inter-arrival time (ms) for the exponential arrival process. */
    meanInterArrivalMs: number;
    urgencyWeights: Record<Urgency, number>;
}

/** Initial resource capacities (plain integers; the engine never assumes more). */
export interface ResourceConfig {
    beds: number;
    doctors: number;
    nurses: number;
}

/**
 * The bed manager's daily decision round. Cancellations are not instant: each
 * round (every `roundIntervalMs`, first at `firstRoundAt`) the manager cancels
 * waiting patients whose wait has exceeded `maxWaitMs` — their elective slot has
 * lapsed with no bed available.
 */
export interface BedManagerConfig {
    roundIntervalMs: number;
    firstRoundAt: number;
    maxWaitMs: number;
    /**
     * How far ahead the manager optimistically counts beds expected to free
     * (based on on-time recovery). Larger = more optimistic = fewer cancellations.
     */
    forecastHorizonMs: number;
}

/** The complete, deterministic configuration for a simulation run. */
export interface EngineConfig {
    seed: number;
    resources: ResourceConfig;
    ward: WardConfig;
    recovery: RecoveryConfig;
    outcomeWeights: OutcomeWeights;
    arrivals: ArrivalConfig;
    bedManager: BedManagerConfig;
}
