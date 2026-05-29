/**
 * Discharge (A03): releases the bed, finalises the patient, emits length of stay
 * and the recorded outcome, then pulls the next waiting patient into the freed
 * bed. Idempotent on stale events.
 */
import type { SimContext } from "../sim/simulation.js";
import type { ScheduledEvent } from "../sim/scheduler.js";
import { PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";
import { freeBeds } from "../state/resources.js";
import { admitWaiting } from "./admission.js";

type DischargeEvent = Extract<ScheduledEvent, { kind: "discharge" }>;

export function handleDischarge(event: DischargeEvent, ctx: SimContext): void {
    const patient = ctx.world.patients.get(event.patientId);
    if (
        patient === undefined ||
        patient.state !== PatientState.ReadyForDischarge
    ) {
        return;
    }
    transition(patient, PatientState.Discharged);
    patient.dischargedAt = ctx.simTime;
    ctx.world.resources.beds.occupied -= 1;
    ctx.world.counters.discharged += 1;
    // A patient that reached ReadyForDischarge was admitted and had an outcome.
    const lengthOfStay = ctx.simTime - patient.admittedAt!;
    ctx.emit({
        kind: "BedReleased",
        simTime: ctx.simTime,
        patientId: patient.id,
        bedsFree: freeBeds(ctx.world.resources),
    });
    ctx.emit({
        kind: "PatientDischarged",
        simTime: ctx.simTime,
        patientId: patient.id,
        outcome: patient.outcome!,
        lengthOfStay,
    });

    admitWaiting(ctx); // the freed bed pulls the next waiting patient
}
