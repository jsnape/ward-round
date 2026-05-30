/**
 * @ward-round/scoring — the NHS-mode scoring read-layer.
 *
 * Reads from a WorldStateReadModel; the engine stays ignorant of it.
 */
export const SCORING_VERSION = "0.0.0";

export {
    type ScoringConfig,
    type Score,
    DEFAULT_SCORING_CONFIG,
    scoreState,
} from "./score.js";

export {
    type BottleneckKind,
    type BottleneckAnalysis,
    analyseBottleneck,
} from "./bottleneck.js";

export { computeThroughputRate } from "./throughput.js";
