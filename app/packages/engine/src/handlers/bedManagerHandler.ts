/**
 * The bed manager's daily round: cancellations are batched decisions, not
 * instant. Each round cancels any waiting patient whose wait has exceeded
 * `maxWaitMs` (their elective slot lapsed with no bed available), then schedules
 * the next round.
 */
import type { SimContext } from "../sim/simulation.js";
import type { ScheduledEvent } from "../sim/scheduler.js";
import { PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";

type BedManagerRoundEvent = Extract<
    ScheduledEvent,
    { kind: "bedManagerRound" }
>;

export function handleBedManagerRound(
    _event: BedManagerRoundEvent,
    ctx: SimContext,
): void {
    const maxWait = ctx.config.bedManager.maxWaitMs;
    for (const patient of ctx.world.patients.values()) {
        if (
            patient.state === PatientState.WaitingList &&
            ctx.simTime - patient.registeredAt >= maxWait
        ) {
            transition(patient, PatientState.Cancelled);
            ctx.world.counters.cancelled += 1;
            ctx.emit({
                kind: "AdmissionCancelled",
                simTime: ctx.simTime,
                patientId: patient.id,
                reason: "no_bed_available",
            });
        }
    }
    ctx.schedule({
        kind: "bedManagerRound",
        time: ctx.simTime + ctx.config.bedManager.roundIntervalMs,
    });
}
