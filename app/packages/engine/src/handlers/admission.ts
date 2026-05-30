/**
 * Pull-based admission: a free, staffed bed pulls the longest-waiting patient
 * off the list. Run whenever capacity may have opened up (on arrival and on
 * discharge). A bed is required to admit; staffing is required to *treat* — an
 * admitted patient with no staff stalls in `Admitted` (Stage 1 simplification).
 */
import type { SimContext } from "../sim/simulation.js";
import { type Patient, PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";
import { freeBeds, hasFreeBed } from "../state/resources.js";
import { treatmentDuration } from "../model/treatment.js";
import { canStartTreatment, freeStaff } from "../model/staffing.js";

function admitOne(patient: Patient, ctx: SimContext): void {
    transition(patient, PatientState.Scheduled);
    patient.scheduledAt = ctx.simTime;
    ctx.emit({
        kind: "PatientScheduled",
        simTime: ctx.simTime,
        patientId: patient.id,
        scheduledFor: ctx.simTime,
    });

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

    const inTreatmentCount = [...ctx.world.patients.values()].filter(
        (p) => p.state === PatientState.InTreatment,
    ).length;
    const { freeDoctors, freeNurses } = freeStaff(
        ctx.world.resources,
        inTreatmentCount,
        ctx.config.ward.acuity,
    );
    if (!canStartTreatment(freeDoctors, freeNurses)) {
        return; // bed seized, treatment stalls until staffing allows
    }

    transition(patient, PatientState.InTreatment);
    patient.treatmentStartedAt = ctx.simTime;
    const duration = treatmentDuration(
        patient.durationClass,
        ctx.config.baseDurationMs,
    );
    // Optimistic estimate (assumes an on-time, complication-free recovery) — the
    // bed manager forecasts free beds from this.
    patient.expectedDischargeAt = ctx.simTime + duration;
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

/** Admits waiting patients (oldest first) while free beds remain. */
export function admitWaiting(ctx: SimContext): void {
    for (const patient of ctx.world.patients.values()) {
        if (!hasFreeBed(ctx.world.resources)) {
            break;
        }
        if (patient.state === PatientState.WaitingList) {
            admitOne(patient, ctx);
        }
    }
}
