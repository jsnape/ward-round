import "@typespec/json-schema";

using TypeSpec.JsonSchema;

/**
 * Ward Round business-event contract — the versioned, published interface that
 * downstream projects consume. This TypeSpec is the single source of truth;
 * TypeScript types are generated from the emitted JSON Schema.
 *
 * DO NOT BREAK WITHOUT A VERSION BUMP (schemaVersion).
 */
@jsonSchema
namespace WardRound;

enum OutcomeTier {
    good,
    complication,
    poor,
}

enum Urgency {
    routine,
    urgent,
    emergency,
}

enum ProcedureId {
    appendectomy,
    hernia_repair,
    cataract_surgery,
    colonoscopy,
    cholecystectomy,
    tonsillectomy,
    knee_arthroscopy,
    cardiac_stent,
    hip_replacement,
    lumbar_fusion,
}

enum CancelReason {
    no_bed_available,
}

enum StaffRole {
    doctor,
    nurse,
}

enum Mode {
    NHS,
}

model GameStartedPayload {
    mode: Mode;
    budget: safeint;
    beds: int32;
    doctors: int32;
    nurses: int32;
}

model WardOpenedPayload {
    wardId: string;
    bedCount: int32;
}

model StaffHiredPayload {
    role: StaffRole;
    count: int32;
    cost: safeint;
}

model PatientRegisteredPayload {
    patientId: string;
    urgency: Urgency;
    procedureId: ProcedureId;
}

model PatientScheduledPayload {
    patientId: string;
    scheduledFor: safeint;
}

model PatientAdmittedPayload {
    patientId: string;
}

model TreatmentStartedPayload {
    patientId: string;
    procedureId: ProcedureId;
    expectedDuration: safeint;
}

model PatientDischargedPayload {
    patientId: string;
    outcome: OutcomeTier;
    lengthOfStay: safeint;
}

model AdmissionCancelledPayload {
    patientId: string;
    reason: CancelReason;
}

model BudgetUpdatedPayload {
    spent: safeint;
    remaining: safeint;
    patientsTreated: int32;
    outcomeScore: float64;
    staffCostToDate: safeint;
}

/** The common envelope shared by every business event. */
model Envelope<Type extends string, Payload> {
    schemaVersion: string;
    eventId: string;
    gameId: string;

    /** Simulation time in integer milliseconds since the game epoch. */
    simTime: safeint;

    /** ISO-8601 real timestamp of emission. */
    wallTime: string;

    type: Type;
    payload: Payload;
}

model GameStarted is Envelope<"GameStarted", GameStartedPayload>;
model WardOpened is Envelope<"WardOpened", WardOpenedPayload>;
model StaffHired is Envelope<"StaffHired", StaffHiredPayload>;
model PatientRegistered
    is Envelope<"PatientRegistered", PatientRegisteredPayload>;
model PatientScheduled
    is Envelope<"PatientScheduled", PatientScheduledPayload>;
model PatientAdmitted is Envelope<"PatientAdmitted", PatientAdmittedPayload>;
model TreatmentStarted
    is Envelope<"TreatmentStarted", TreatmentStartedPayload>;
model PatientDischarged
    is Envelope<"PatientDischarged", PatientDischargedPayload>;
model AdmissionCancelled
    is Envelope<"AdmissionCancelled", AdmissionCancelledPayload>;
model BudgetUpdated is Envelope<"BudgetUpdated", BudgetUpdatedPayload>;

@oneOf
union BusinessEvent {
    GameStarted,
    WardOpened,
    StaffHired,
    PatientRegistered,
    PatientScheduled,
    PatientAdmitted,
    TreatmentStarted,
    PatientDischarged,
    AdmissionCancelled,
    BudgetUpdated,
}
