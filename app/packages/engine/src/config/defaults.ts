/**
 * A known-good default configuration. Used to bootstrap the UI and as the basis
 * for tests. The numbers are starting points for play-tuning, not sacred values.
 */
import type { EngineConfig } from "./types.js";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
    seed: 1,
    resources: { beds: 8, doctors: 3, nurses: 6 },
    ward: { acuity: 0.5 }, // 1 nurse per 2 beds; general medicine standard
    recovery: {
        complicationMs: 2 * MS_PER_DAY,
        poorMs: 5 * MS_PER_DAY,
    },
    outcomeWeights: { good: 0.7, complication: 0.2, poor: 0.1 },
    arrivals: {
        meanInterArrivalMs: 0.8 * MS_PER_DAY, // 25% higher pressure than Stage 1
        urgencyWeights: { routine: 0.6, urgent: 0.3, emergency: 0.1 },
    },
    bedManager: {
        roundIntervalMs: MS_PER_DAY,
        firstRoundAt: 8 * 60 * 60 * 1000, // 08:00 on day 0
        maxWaitMs: 3 * MS_PER_DAY,       // more tension before cancellation
        forecastHorizonMs: 0.5 * MS_PER_DAY, // more pessimistic → more cancellations
    },
};
