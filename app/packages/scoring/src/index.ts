/**
 * @ward-round/scoring — the NHS-mode scoring read-layer.
 *
 * Placeholder barrel for the §1 skeleton; the pure scoring + budget functions
 * land in §10. Reads from a WorldStateReadModel; the engine stays ignorant of it.
 */
export const SCORING_VERSION = "0.0.0";

export {
    type ScoringConfig,
    type Score,
    DEFAULT_SCORING_CONFIG,
    scoreState,
} from "./score.js";
