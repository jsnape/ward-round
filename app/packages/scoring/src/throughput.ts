import { MS_PER_DAY } from "@ward-round/engine";

/** Discharges per sim-day. Returns 0 if no simulation time has elapsed. */
export function computeThroughputRate(
    discharged: number,
    simTime: number,
): number {
    if (simTime <= 0) return 0;
    return discharged / (simTime / MS_PER_DAY);
}
