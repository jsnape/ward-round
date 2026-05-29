/**
 * Ward resources. Beds are a seizable integer pool; doctors and nurses are
 * headcount pools (not per-bed ratios). Capacity is just numbers — the engine
 * never assumes it comes from anything more (the building layer is a later stage).
 */
import type { ResourceConfig } from "../config/types.js";

export interface ResourceState {
    beds: { capacity: number; occupied: number };
    doctors: { headcount: number };
    nurses: { headcount: number };
}

/** Builds the initial resource pools from config, with no beds occupied. */
export function createResourceState(config: ResourceConfig): ResourceState {
    return {
        beds: { capacity: config.beds, occupied: 0 },
        doctors: { headcount: config.doctors },
        nurses: { headcount: config.nurses },
    };
}

/** Number of free beds. */
export function freeBeds(state: ResourceState): number {
    return state.beds.capacity - state.beds.occupied;
}

/** Whether at least one bed is free. */
export function hasFreeBed(state: ResourceState): boolean {
    return freeBeds(state) > 0;
}
