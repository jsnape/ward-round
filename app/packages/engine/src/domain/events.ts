/**
 * Tier-1 domain events: the engine's own rich, fine-grained vocabulary for what
 * happened. These are an implementation detail consumed by the UI and by the
 * contract translator; they are free to change. They carry no knowledge of HL7,
 * money, or the wire format.
 *
 * Every event carries `simTime` so consumers never have to ask the clock.
 */
import type { OutcomeTier, Urgency } from "../state/patient.js";
import type { ProcedureId } from "../config/procedures.js";

/** Engine-native summary emitted at game start (no scoring/mode concepts). */
export interface EngineConfigSummary {
    seed: number;
    beds: number;
    doctors: number;
    nurses: number;
}

export type DomainEvent =
    | { kind: "GameStarted"; simTime: number; config: EngineConfigSummary }
    | {
          kind: "PatientRegistered";
          simTime: number;
          patientId: string;
          urgency: Urgency;
          procedureId: ProcedureId;
      }
    | {
          kind: "PatientScheduled";
          simTime: number;
          patientId: string;
          scheduledFor: number;
      }
    | {
          kind: "BedSeized";
          simTime: number;
          patientId: string;
          bedsFree: number;
      }
    | { kind: "PatientAdmitted"; simTime: number; patientId: string }
    | {
          kind: "AdmissionCancelled";
          simTime: number;
          patientId: string;
          reason: "no_bed_available";
      }
    | {
          kind: "TreatmentStarted";
          simTime: number;
          patientId: string;
          procedureId: ProcedureId;
          expectedDuration: number;
      }
    | {
          kind: "OutcomeRolled";
          simTime: number;
          patientId: string;
          outcome: OutcomeTier;
      }
    | {
          kind: "BedReleased";
          simTime: number;
          patientId: string;
          bedsFree: number;
      }
    | {
          kind: "PatientDischarged";
          simTime: number;
          patientId: string;
          outcome: OutcomeTier;
          lengthOfStay: number;
      }
    | {
          kind: "StaffChanged";
          simTime: number;
          role: "doctor" | "nurse";
          count: number;
      };

/** The discriminant of {@link DomainEvent}. */
export type DomainEventKind = DomainEvent["kind"];

export const DOMAIN_EVENT_KINDS: readonly DomainEventKind[] = [
    "GameStarted",
    "PatientRegistered",
    "PatientScheduled",
    "BedSeized",
    "PatientAdmitted",
    "AdmissionCancelled",
    "TreatmentStarted",
    "OutcomeRolled",
    "BedReleased",
    "PatientDischarged",
    "StaffChanged",
];

/**
 * Structural guard for an unknown value (e.g. a replayed/deserialised record):
 * a known `kind` plus a numeric `simTime`. Useful at trust boundaries.
 */
export function isDomainEvent(value: unknown): value is DomainEvent {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        typeof record["kind"] === "string" &&
        (DOMAIN_EVENT_KINDS as readonly string[]).includes(record["kind"]) &&
        typeof record["simTime"] === "number"
    );
}

/** Narrows a domain event to a specific kind. */
export function isEventKind<K extends DomainEventKind>(
    event: DomainEvent,
    kind: K,
): event is Extract<DomainEvent, { kind: K }> {
    return event.kind === kind;
}
