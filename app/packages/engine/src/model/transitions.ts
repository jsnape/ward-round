/**
 * The patient state machine as pure, guarded functions plus an explicit
 * allowed-transition table. The table is the single source of truth for the
 * legal lifecycle graph; illegal transitions throw.
 *
 * Cancellation edges: `WaitingList -> Cancelled` (the bed manager's daily round
 * cancels a patient whose wait has lapsed with no bed), plus the transient
 * `Scheduled -> Cancelled` / `Admitted -> Cancelled` edges kept legal for the
 * lifecycle's completeness.
 */
import { type Patient, PatientState } from "../state/patient.js";

const ALLOWED: Readonly<Record<PatientState, readonly PatientState[]>> = {
    [PatientState.WaitingList]: [
        PatientState.Scheduled,
        PatientState.Cancelled,
    ],
    [PatientState.Scheduled]: [PatientState.Admitted, PatientState.Cancelled],
    [PatientState.Admitted]: [PatientState.InTreatment, PatientState.Cancelled],
    [PatientState.InTreatment]: [PatientState.ReadyForDischarge],
    [PatientState.ReadyForDischarge]: [PatientState.Discharged],
    [PatientState.Discharged]: [],
    [PatientState.Cancelled]: [],
};

/** Whether moving `from -> to` is a legal lifecycle transition. */
export function canTransition(from: PatientState, to: PatientState): boolean {
    return ALLOWED[from].includes(to);
}

/** Throws if `from -> to` is not a legal transition. */
export function assertTransition(from: PatientState, to: PatientState): void {
    if (!canTransition(from, to)) {
        throw new Error(`illegal patient transition: ${from} -> ${to}`);
    }
}

/** Applies a guarded transition to a patient, mutating its state in place. */
export function transition(patient: Patient, to: PatientState): void {
    assertTransition(patient.state, to);
    patient.state = to;
}
