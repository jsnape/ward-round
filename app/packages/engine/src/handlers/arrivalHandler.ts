/**
 * Arrival (the engine's only self-perpetuating event): registers a new patient
 * on the waiting list, keeps the arrival stream going, and queues the patient
 * for scheduling. Patient attributes and the next gap are drawn from the
 * arrivals RNG stream.
 */
import type { EventHandler } from "../sim/simulation.js";
import { createPatient } from "../state/patient.js";
import {
    drawDurationClass,
    drawUrgency,
    nextInterArrival,
} from "../model/arrivals.js";

export const handleArrival: EventHandler = (_event, ctx) => {
    // Keep the arrival process alive before anything else can go wrong.
    const gap = nextInterArrival(
        ctx.config.arrivals.meanInterArrivalMs,
        ctx.rng.arrivals,
    );
    ctx.schedule({ kind: "arrival", time: ctx.simTime + gap });

    const urgency = drawUrgency(ctx.config.arrivals, ctx.rng.arrivals);
    const durationClass = drawDurationClass(
        ctx.config.arrivals,
        ctx.rng.arrivals,
    );
    const id = ctx.ids.next();
    ctx.world.patients.set(
        id,
        createPatient({
            id,
            urgency,
            durationClass,
            registeredAt: ctx.simTime,
        }),
    );
    ctx.world.counters.registered += 1;
    ctx.emit({
        kind: "PatientRegistered",
        simTime: ctx.simTime,
        patientId: id,
        urgency,
        durationClass,
    });

    // Stage 1 pulls from the waiting list immediately (FIFO, no urgency ordering).
    ctx.schedule({ kind: "schedule", time: ctx.simTime, patientId: id });
};
