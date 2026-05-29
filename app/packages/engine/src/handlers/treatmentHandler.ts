/**
 * Treatment completion and recovery. The first completion rolls the stochastic
 * outcome. A `good` outcome means the patient is well and ready for discharge.
 * A `complication`/`poor` outcome means the patient is not yet well: they keep
 * occupying the bed for a recovery period, after which a second completion
 * readies them for discharge. Idempotent on stale events.
 */
import type { SimContext } from "../sim/simulation.js";
import type { ScheduledEvent } from "../sim/scheduler.js";
import { PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";
import { recoveryTime, rollOutcome } from "../model/treatment.js";

type TreatmentCompleteEvent = Extract<
    ScheduledEvent,
    { kind: "treatmentComplete" }
>;

export function handleTreatmentComplete(
    event: TreatmentCompleteEvent,
    ctx: SimContext,
): void {
    const patient = ctx.world.patients.get(event.patientId);
    if (patient === undefined || patient.state !== PatientState.InTreatment) {
        return;
    }

    // First completion: roll the outcome. A not-well patient recovers in-bed.
    if (patient.outcome === undefined) {
        const outcome = rollOutcome(
            ctx.config.outcomeWeights,
            ctx.rng.outcomes,
        );
        patient.outcome = outcome;
        ctx.emit({
            kind: "OutcomeRolled",
            simTime: ctx.simTime,
            patientId: patient.id,
            outcome,
        });
        const recovery = recoveryTime(outcome, ctx.config.recovery);
        if (recovery > 0) {
            ctx.schedule({
                kind: "treatmentComplete",
                time: ctx.simTime + recovery,
                patientId: patient.id,
            });
            return; // not well yet — stays in the bed, recovering
        }
    }

    // Well now (good outcome, or recovery period elapsed): ready for discharge.
    transition(patient, PatientState.ReadyForDischarge);
    ctx.schedule({
        kind: "discharge",
        time: ctx.simTime,
        patientId: patient.id,
    });
}
