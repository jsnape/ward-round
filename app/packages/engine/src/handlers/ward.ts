/**
 * Wires the lifecycle handlers into a ready-to-run ward simulation. This is the
 * production entry point; the generic `createSimulation` remains available for
 * tests and advanced wiring.
 */
import type { EngineConfig } from "../config/types.js";
import { DEFAULT_ENGINE_CONFIG } from "../config/defaults.js";
import {
    type EventHandler,
    type HandlerRegistry,
    type SimContext,
    type Simulation,
    createSimulation,
} from "../sim/simulation.js";
import { handleArrival } from "./arrivalHandler.js";
import { handleSchedule } from "./scheduleHandler.js";
import { handleAdmit } from "./admitHandler.js";
import { handleTreatmentComplete } from "./treatmentHandler.js";
import { handleDischarge } from "./dischargeHandler.js";

// Each patient handler is typed to its specific event variant; the registry
// stores them under their kind. The casts are safe: the scheduler only ever
// dispatches an event to the handler registered under its own kind.
export const wardHandlers: HandlerRegistry = {
    arrival: handleArrival,
    schedule: handleSchedule as EventHandler,
    admit: handleAdmit as EventHandler,
    treatmentComplete: handleTreatmentComplete as EventHandler,
    discharge: handleDischarge as EventHandler,
};

/** Seeds the first arrival; the arrival handler perpetuates the stream. */
export function wardBootstrap(ctx: SimContext): void {
    ctx.schedule({ kind: "arrival", time: ctx.simTime });
}

/** Creates a fully-wired, ready-to-run ward simulation. */
export function createWardSimulation(
    config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): Simulation {
    return createSimulation(config, {
        handlers: wardHandlers,
        bootstrap: wardBootstrap,
    });
}
