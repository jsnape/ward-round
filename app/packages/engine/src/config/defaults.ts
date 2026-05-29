/**
 * A known-good default configuration. Used to bootstrap the UI and as the basis
 * for tests. The numbers are starting points for play-tuning, not sacred values.
 */
import type { EngineConfig } from "./types.js";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
    seed: 1,
    resources: { beds: 10, doctors: 3, nurses: 5 },
    staffing: { minDoctors: 1, minNurses: 1, softBonusPerExtra: 0.1 },
    baseDurationMs: {
        short: 1 * MS_PER_DAY,
        medium: 3 * MS_PER_DAY,
        long: 7 * MS_PER_DAY,
    },
    recovery: {
        complicationMs: 2 * MS_PER_DAY,
        poorMs: 5 * MS_PER_DAY,
    },
    outcomeWeights: { good: 0.7, complication: 0.2, poor: 0.1 },
    arrivals: {
        meanInterArrivalMs: 1 * MS_PER_DAY,
        urgencyWeights: { routine: 0.6, urgent: 0.3, emergency: 0.1 },
        durationClassWeights: { short: 0.5, medium: 0.35, long: 0.15 },
    },
    bedManager: {
        roundIntervalMs: MS_PER_DAY,
        firstRoundAt: 8 * 60 * 60 * 1000, // 08:00 on day 0
        maxWaitMs: 2 * MS_PER_DAY,
        forecastHorizonMs: 1 * MS_PER_DAY,
    },
};
