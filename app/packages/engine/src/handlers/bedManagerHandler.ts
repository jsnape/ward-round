/**
 * The bed manager's daily round. Cancellations are batched decisions, not
 * instant — and the manager is optimistic: it counts beds it *expects* to free
 * within the forecast horizon (from on-time recovery estimates) as if they were
 * available, and only cancels the long-waiters that even that optimism cannot
 * place. Then it schedules the next round.
 */
import type { SimContext } from "../sim/simulation.js";
import type { ScheduledEvent } from "../sim/scheduler.js";
import { type Patient, PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";
import { freeBeds } from "../state/resources.js";

type BedManagerRoundEvent = Extract<
    ScheduledEvent,
    { kind: "bedManagerRound" }
>;

const BED_STATES: ReadonlySet<PatientState> = new Set([
    PatientState.Admitted,
    PatientState.InTreatment,
    PatientState.ReadyForDischarge,
]);

export function handleBedManagerRound(
    _event: BedManagerRoundEvent,
    ctx: SimContext,
): void {
    const { maxWaitMs, forecastHorizonMs, roundIntervalMs } =
        ctx.config.bedManager;
    const horizonEnd = ctx.simTime + forecastHorizonMs;

    let expectedFrees = 0;
    const longWaiters: Patient[] = [];
    for (const patient of ctx.world.patients.values()) {
        if (
            BED_STATES.has(patient.state) &&
            patient.expectedDischargeAt !== undefined &&
            patient.expectedDischargeAt <= horizonEnd
        ) {
            expectedFrees += 1;
        }
        if (
            patient.state === PatientState.WaitingList &&
            ctx.simTime - patient.registeredAt >= maxWaitMs
        ) {
            longWaiters.push(patient);
        }
    }

    // Optimistically keep the oldest `capacity` long-waiters; cancel the overflow.
    const capacity = freeBeds(ctx.world.resources) + expectedFrees;
    for (let i = capacity; i < longWaiters.length; i++) {
        const patient = longWaiters[i]!;
        transition(patient, PatientState.Cancelled);
        ctx.world.counters.cancelled += 1;
        ctx.emit({
            kind: "AdmissionCancelled",
            simTime: ctx.simTime,
            patientId: patient.id,
            reason: "no_bed_available",
        });
    }

    ctx.schedule({
        kind: "bedManagerRound",
        time: ctx.simTime + roundIntervalMs,
    });
}
