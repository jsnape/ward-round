/**
 * @ward-round/host — the framework-agnostic simulation driver.
 *
 * Placeholder barrel for the §1 skeleton; the wall-to-sim time mapping,
 * pause/speed state, and runUntil budgeting land in §11. No DOM, no Svelte.
 */
export const HOST_VERSION = "0.0.0";

export {
    type SimDriverOptions,
    SimDriver,
    SPEED_PRESETS,
    DEFAULT_SIM_MS_PER_WALL_MS,
} from "./driver.js";
