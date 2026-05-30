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
import type { PortableState } from "../state/worldState.js";
import { PatientState } from "../state/patient.js";
import { nextInterArrival } from "../model/arrivals.js";
import { handleArrival } from "./arrivalHandler.js";
import { handleTreatmentComplete } from "./treatmentHandler.js";
import { handleDischarge } from "./dischargeHandler.js";
import { handleBedManagerRound } from "./bedManagerHandler.js";
import { admitWaiting } from "./admission.js";

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
        onResourcesChanged: admitWaiting,
    });
}

/**
 * Resumes a ward simulation from a portable snapshot: re-derives the pending
 * events (in-flight treatments, ready discharges, the next arrival and round),
 * fills any free beds, and continues with a freshly-seeded RNG. `GameStarted`
 * is not re-emitted — past history lives in the saved business-event log.
 */
export function wardRestoreBootstrap(ctx: SimContext): void {
    const gap = nextInterArrival(
        ctx.config.arrivals.meanInterArrivalMs,
        ctx.rng.arrivals,
    );
    ctx.schedule({ kind: "arrival", time: ctx.simTime + gap });
    ctx.schedule({
        kind: "bedManagerRound",
        time: ctx.simTime + ctx.config.bedManager.roundIntervalMs,
    });

    for (const patient of ctx.world.patients.values()) {
        if (patient.state === PatientState.InTreatment) {
            const at = Math.max(
                ctx.simTime,
                patient.expectedDischargeAt ?? ctx.simTime,
            );
            ctx.schedule({
                kind: "treatmentComplete",
                time: at,
                patientId: patient.id,
            });
        } else if (patient.state === PatientState.ReadyForDischarge) {
            ctx.schedule({
                kind: "discharge",
                time: ctx.simTime,
                patientId: patient.id,
            });
        }
    }

    admitWaiting(ctx);
}

/** Resumes a ward simulation from a saved portable snapshot. */
export function createWardSimulationFromSnapshot(
    snapshot: PortableState,
    config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): Simulation {
    return createSimulation(config, {
        handlers: wardHandlers,
        bootstrap: wardRestoreBootstrap,
        initialState: snapshot,
        suppressGameStarted: true,
        onResourcesChanged: admitWaiting,
    });
}
