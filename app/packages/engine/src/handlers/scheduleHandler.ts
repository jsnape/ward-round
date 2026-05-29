/**
 * Schedule (A05): pulls a waiting patient into a scheduled admission slot.
 * Idempotent — no-ops if the patient is gone or no longer on the waiting list.
 */
import type { SimContext } from "../sim/simulation.js";
import type { ScheduledEvent } from "../sim/scheduler.js";
import { PatientState } from "../state/patient.js";
import { transition } from "../model/transitions.js";

type ScheduleEvent = Extract<ScheduledEvent, { kind: "schedule" }>;

export function handleSchedule(event: ScheduleEvent, ctx: SimContext): void {
    const patient = ctx.world.patients.get(event.patientId);
    if (patient === undefined || patient.state !== PatientState.WaitingList) {
        return;
    }
    transition(patient, PatientState.Scheduled);
    patient.scheduledAt = ctx.simTime;
    ctx.emit({
        kind: "PatientScheduled",
        simTime: ctx.simTime,
        patientId: patient.id,
        scheduledFor: ctx.simTime,
    });
    ctx.schedule({ kind: "admit", time: ctx.simTime, patientId: patient.id });
}
