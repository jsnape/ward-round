/**
 * Treatment completion: rolls the stochastic outcome, moves the patient to
 * ReadyForDischarge, and queues discharge. The outcome is drawn from the
 * outcomes RNG stream. Idempotent on stale events (e.g. a completion queued for
 * a patient no longer in treatment).
 */
import type { SimContext } from "../sim/simulation.js";
import type { ScheduledEvent } from "../sim/scheduler.js";
import { PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";
import { rollOutcome } from "../model/treatment.js";

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
    const outcome = rollOutcome(ctx.config.outcomeWeights, ctx.rng.outcomes);
    patient.outcome = outcome;
    transition(patient, PatientState.ReadyForDischarge);
    ctx.emit({
        kind: "OutcomeRolled",
        simTime: ctx.simTime,
        patientId: patient.id,
        outcome,
    });
    ctx.schedule({
        kind: "discharge",
        time: ctx.simTime,
        patientId: patient.id,
    });
}
