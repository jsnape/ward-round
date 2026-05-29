/**
 * @ward-round/engine — the neutral discrete-event simulation core.
 *
 * The public barrel: the only supported import surface. The engine moves
 * patients through resources and rolls outcomes; it has no knowledge of Svelte,
 * HTTP, HL7, money, or scoring.
 */
export const ENGINE_VERSION = "0.0.0";

// Construction + orchestration
export {
    createWardSimulation,
    wardHandlers,
    wardBootstrap,
} from "./handlers/ward.js";
export { createSimulation } from "./sim/simulation.js";
export type {
    Simulation,
    SimulationDeps,
    SimContext,
    EventHandler,
    HandlerRegistry,
} from "./sim/simulation.js";

// Scheduler
export { EventScheduler } from "./sim/scheduler.js";
export type {
    EventKind,
    ScheduledEvent,
    ScheduledEventInput,
} from "./sim/scheduler.js";

// World state + read model
export { createWorldState, projectReadModel } from "./state/worldState.js";
export type {
    WorldState,
    WorldStateReadModel,
    WorldCounters,
    PatientView,
} from "./state/worldState.js";

// Patient vocabulary + resources
export {
    PatientState,
    URGENCIES,
    DURATION_CLASSES,
    OUTCOME_TIERS,
    createPatient,
} from "./state/patient.js";
export type {
    Patient,
    Urgency,
    DurationClass,
    OutcomeTier,
} from "./state/patient.js";
export {
    createResourceState,
    freeBeds,
    hasFreeBed,
} from "./state/resources.js";
export type { ResourceState } from "./state/resources.js";

// Domain events
export {
    DOMAIN_EVENT_KINDS,
    isDomainEvent,
    isEventKind,
} from "./domain/events.js";
export type {
    DomainEvent,
    DomainEventKind,
    EngineConfigSummary,
} from "./domain/events.js";
export { DomainEmitter } from "./domain/emitter.js";
export type { DomainEventListener } from "./domain/emitter.js";

// Model (pure domain math)
export {
    throughputMultiplier,
    isStaffed,
    treatmentDuration,
    rollOutcome,
} from "./model/treatment.js";
export {
    nextInterArrival,
    drawUrgency,
    drawDurationClass,
} from "./model/arrivals.js";
export {
    canTransition,
    assertTransition,
    transition,
} from "./model/transitions.js";

// RNG (deterministic)
export { createRng, Mulberry32Rng, weightedPick } from "./rng/rng.js";
export type { Rng } from "./rng/rng.js";

// Config
export { DEFAULT_ENGINE_CONFIG, MS_PER_DAY } from "./config/defaults.js";
export type {
    EngineConfig,
    ResourceConfig,
    StaffingConfig,
    ArrivalConfig,
    OutcomeWeights,
    DurationConfig,
} from "./config/types.js";
