/**
 * The patient entity and its lifecycle vocabulary.
 *
 * Patients are lightweight in-memory objects. The HL7 ADT trigger names (A05,
 * A01, A11, A03) are conceptual labels for the transitions, never a runtime data
 * format — see the spec.
 */
import type { ProcedureId } from "../config/procedures.js";

/** The patient lifecycle states. `Discharged` and `Cancelled` are terminal. */
export enum PatientState {
    WaitingList = "WaitingList",
    Scheduled = "Scheduled",
    Admitted = "Admitted",
    InTreatment = "InTreatment",
    ReadyForDischarge = "ReadyForDischarge",
    Discharged = "Discharged",
    Cancelled = "Cancelled",
}

/** Clinical priority. Recorded in Stage 1 but not yet acted on (FIFO scheduling). */
export type Urgency = "routine" | "urgent" | "emergency";
export const URGENCIES: readonly Urgency[] = ["routine", "urgent", "emergency"];

/** The stochastic result of a completed treatment, best to worst. */
export type OutcomeTier = "good" | "complication" | "poor";
export const OUTCOME_TIERS: readonly OutcomeTier[] = [
    "good",
    "complication",
    "poor",
];

/** A simulated patient. Timestamps are integer ms of simTime; absent until reached. */
export interface Patient {
    readonly id: string;
    state: PatientState;
    readonly urgency: Urgency;
    readonly procedureId: ProcedureId;
    readonly registeredAt: number;
    scheduledAt?: number;
    admittedAt?: number;
    treatmentStartedAt?: number;
    /** Optimistic (on-time) discharge estimate, set at treatment start. */
    expectedDischargeAt?: number;
    dischargedAt?: number;
    outcome?: OutcomeTier;
}

/** Creates a patient newly placed on the waiting list. */
export function createPatient(args: {
    id: string;
    urgency: Urgency;
    procedureId: ProcedureId;
    registeredAt: number;
}): Patient {
    return {
        id: args.id,
        state: PatientState.WaitingList,
        urgency: args.urgency,
        procedureId: args.procedureId,
        registeredAt: args.registeredAt,
    };
}

export type { ProcedureId } from "../config/procedures.js";
