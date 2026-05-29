/**
 * Admit (A01) / cancel (A11): the bed decision.
 *
 * - No free bed at the scheduled time → cancel with `no_bed_available`.
 * - Free bed → seize it and admit, then start treatment *if staffed*. Below the
 *   staffing floor the patient stays `Admitted` and treatment stalls (Stage 1
 *   simplification: the floor gates starting treatment; in-flight treatments are
 *   never frozen). Idempotent on stale events.
 */
import type { SimContext } from "../sim/simulation.js";
import type { ScheduledEvent } from "../sim/scheduler.js";
import { PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";
import { freeBeds, hasFreeBed } from "../state/resources.js";
import { isStaffed, treatmentDuration } from "../model/treatment.js";

type AdmitEvent = Extract<ScheduledEvent, { kind: "admit" }>;

export function handleAdmit(event: AdmitEvent, ctx: SimContext): void {
    const patient = ctx.world.patients.get(event.patientId);
    if (patient === undefined || patient.state !== PatientState.Scheduled) {
        return;
    }

    if (!hasFreeBed(ctx.world.resources)) {
        transition(patient, PatientState.Cancelled);
        ctx.world.counters.cancelled += 1;
        ctx.emit({
            kind: "AdmissionCancelled",
            simTime: ctx.simTime,
            patientId: patient.id,
            reason: "no_bed_available",
        });
        return;
    }

    ctx.world.resources.beds.occupied += 1;
    transition(patient, PatientState.Admitted);
    patient.admittedAt = ctx.simTime;
    ctx.world.counters.admitted += 1;
    ctx.emit({
        kind: "BedSeized",
        simTime: ctx.simTime,
        patientId: patient.id,
        bedsFree: freeBeds(ctx.world.resources),
    });
    ctx.emit({
        kind: "PatientAdmitted",
        simTime: ctx.simTime,
        patientId: patient.id,
    });

    const { headcount: doctors } = ctx.world.resources.doctors;
    const { headcount: nurses } = ctx.world.resources.nurses;
    if (!isStaffed(doctors, nurses, ctx.config.staffing)) {
        return; // understaffed: treatment stalls, patient remains Admitted
    }

    transition(patient, PatientState.InTreatment);
    patient.treatmentStartedAt = ctx.simTime;
    const duration = treatmentDuration(
        patient.durationClass,
        doctors,
        nurses,
        ctx.config.staffing,
        ctx.config.baseDurationMs,
    );
    ctx.emit({
        kind: "TreatmentStarted",
        simTime: ctx.simTime,
        patientId: patient.id,
        expectedDuration: duration,
    });
    ctx.schedule({
        kind: "treatmentComplete",
        time: ctx.simTime + duration,
        patientId: patient.id,
    });
}
