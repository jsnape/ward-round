/**
 * The arrival process: exponential inter-arrival times (a Poisson process) and
 * the attribute draws for an arriving patient. Pure functions over an injected
 * Rng so the whole arrival stream is reproducible.
 */
import { type Rng, weightedPick } from "../rng/rng.js";
import type { ArrivalConfig } from "../config/types.js";
import { type Urgency, URGENCIES } from "../state/patient.js";

/**
 * Samples the next inter-arrival gap (integer ms, >= 1) from an exponential
 * distribution with the given mean. Throws if the mean is not positive.
 */
export function nextInterArrival(meanMs: number, rng: Rng): number {
    if (meanMs <= 0) {
        throw new RangeError(`mean inter-arrival must be positive: ${meanMs}`);
    }
    // 1 - next() lies in (0, 1], so the log is always defined.
    const gap = -meanMs * Math.log(1 - rng.next());
    return Math.max(1, Math.round(gap));
}

/** Draws an arriving patient's urgency from the configured weights. */
export function drawUrgency(cfg: ArrivalConfig, rng: Rng): Urgency {
    const w = URGENCIES.map((u) => cfg.urgencyWeights[u]);
    return URGENCIES[weightedPick(w, rng)]!;
}
