/**
 * The translator: subscribes to the engine's fine-grained domain events and
 * shapes the coarse, versioned business-event subset that goes outward. It is
 * the only place that knows both tiers, and it keeps its own derived state for
 * accumulated events (BudgetUpdated). It sees only the engine's *public* domain
 * union — never engine internals — which keeps the boundary honest.
 */
import { MS_PER_DAY, type DomainEvent, type OutcomeTier } from "@ward-round/engine";
import type {
    AdmissionCancelledJson,
    BudgetUpdatedJson,
    BusinessEventJson,
    GameStartedJson,
    PatientAdmittedJson,
    PatientDischargedJson,
    PatientRegisteredJson,
    PatientScheduledJson,
    TreatmentStartedJson,
} from "../generated/businessEvents.js";
import { SCHEMA_VERSION } from "./version.js";

/** Where shaped business events are delivered. */
export interface BusinessEventSink {
    emit(event: BusinessEventJson): void;
}

/** Scoring inputs the translator needs to derive the BudgetUpdated event. */
export interface TranslatorConfig {
    budget: number;
    paymentPerDischarge: number;
    outcomeScore: Record<OutcomeTier, number>;
    mode?: "NHS";
    dailyDoctorCost: number;
    dailyNurseCost: number;
    dailyBedCost: number;
}

/** Injectable dependencies (defaults are non-deterministic, hence injectable). */
export interface TranslatorDeps {
    sink: BusinessEventSink;
    gameId?: string;
    newEventId?: () => string;
    now?: () => Date;
}

export interface Translator {
    /** Map one domain event to zero or more business events. */
    handle(event: DomainEvent): void;
}

export function createTranslator(
    config: TranslatorConfig,
    deps: TranslatorDeps,
): Translator {
    const gameId = deps.gameId ?? globalThis.crypto.randomUUID();
    const newEventId =
        deps.newEventId ?? (() => globalThis.crypto.randomUUID());
    const now = deps.now ?? (() => new Date());
    const mode = config.mode ?? "NHS";

    let patientsTreated = 0;
    let outcomeScore = 0;
    // Staff/bed headcounts for salary computation — updated from events.
    let doctors = 0;
    let nurses = 0;
    let beds = 0;

    function staffCostAt(simTime: number): number {
        const simDays = simTime / MS_PER_DAY;
        return Math.round(
            simDays *
                (doctors * config.dailyDoctorCost +
                    nurses * config.dailyNurseCost +
                    beds * config.dailyBedCost),
        );
    }

    function wrap<E extends BusinessEventJson>(
        type: E["type"],
        simTime: number,
        payload: E["payload"],
    ): E {
        return {
            schemaVersion: SCHEMA_VERSION,
            eventId: newEventId(),
            gameId,
            simTime,
            wallTime: now().toISOString(),
            type,
            payload,
        } as E;
    }

    return {
        handle(event: DomainEvent): void {
            switch (event.kind) {
                case "GameStarted":
                    doctors = event.config.doctors;
                    nurses = event.config.nurses;
                    beds = event.config.beds;
                    deps.sink.emit(
                        wrap<GameStartedJson>("GameStarted", event.simTime, {
                            mode,
                            budget: config.budget,
                            beds,
                            doctors,
                            nurses,
                        }),
                    );
                    break;
                case "StaffChanged":
                    if (event.role === "doctor") {
                        doctors = event.count;
                    } else {
                        nurses = event.count;
                    }
                    break;
                case "PatientRegistered":
                    deps.sink.emit(
                        wrap<PatientRegisteredJson>(
                            "PatientRegistered",
                            event.simTime,
                            {
                                patientId: event.patientId,
                                urgency: event.urgency,
                                procedureId: event.procedureId,
                            },
                        ),
                    );
                    break;
                case "PatientScheduled":
                    deps.sink.emit(
                        wrap<PatientScheduledJson>(
                            "PatientScheduled",
                            event.simTime,
                            {
                                patientId: event.patientId,
                                scheduledFor: event.scheduledFor,
                            },
                        ),
                    );
                    break;
                case "PatientAdmitted":
                    deps.sink.emit(
                        wrap<PatientAdmittedJson>(
                            "PatientAdmitted",
                            event.simTime,
                            { patientId: event.patientId },
                        ),
                    );
                    break;
                case "TreatmentStarted":
                    deps.sink.emit(
                        wrap<TreatmentStartedJson>(
                            "TreatmentStarted",
                            event.simTime,
                            {
                                patientId: event.patientId,
                                procedureId: event.procedureId,
                                expectedDuration: event.expectedDuration,
                            },
                        ),
                    );
                    break;
                case "AdmissionCancelled":
                    deps.sink.emit(
                        wrap<AdmissionCancelledJson>(
                            "AdmissionCancelled",
                            event.simTime,
                            {
                                patientId: event.patientId,
                                reason: event.reason,
                            },
                        ),
                    );
                    break;
                case "PatientDischarged": {
                    deps.sink.emit(
                        wrap<PatientDischargedJson>(
                            "PatientDischarged",
                            event.simTime,
                            {
                                patientId: event.patientId,
                                outcome: event.outcome,
                                lengthOfStay: event.lengthOfStay,
                            },
                        ),
                    );
                    patientsTreated += 1;
                    outcomeScore += config.outcomeScore[event.outcome];
                    const staffCostToDate = staffCostAt(event.simTime);
                    const dischargeIncome =
                        patientsTreated * config.paymentPerDischarge;
                    deps.sink.emit(
                        wrap<BudgetUpdatedJson>(
                            "BudgetUpdated",
                            event.simTime,
                            {
                                spent: staffCostToDate,
                                remaining:
                                    config.budget +
                                    dischargeIncome -
                                    staffCostToDate,
                                patientsTreated,
                                outcomeScore,
                                staffCostToDate,
                            },
                        ),
                    );
                    break;
                }
                // BedSeized, OutcomeRolled, BedReleased are engine-internal
                // and not part of the published contract.
                default:
                    break;
            }
        },
    };
}
