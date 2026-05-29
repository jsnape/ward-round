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
import { handleTreatmentComplete } from "./treatmentHandler.js";
import { handleDischarge } from "./dischargeHandler.js";
import { handleBedManagerRound } from "./bedManagerHandler.js";

// Patient handlers are typed to their specific event variant; the casts are safe
// because the scheduler only dispatches an event to the handler under its kind.
export const wardHandlers: HandlerRegistry = {
    arrival: handleArrival,
    treatmentComplete: handleTreatmentComplete as EventHandler,
    discharge: handleDischarge as EventHandler,
    bedManagerRound: handleBedManagerRound as EventHandler,
};

/** Seeds the first arrival and the first bed-manager round. */
export function wardBootstrap(ctx: SimContext): void {
    ctx.schedule({ kind: "arrival", time: ctx.simTime });
    ctx.schedule({
        kind: "bedManagerRound",
        time: ctx.config.bedManager.firstRoundAt,
    });
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
