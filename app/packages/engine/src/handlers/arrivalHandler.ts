/**
 * Arrival (the engine's self-perpetuating event): registers a new patient on the
 * waiting list, keeps the arrival stream going, then tries to admit waiting
 * patients into any free beds. The waiting list grows when arrivals outpace
 * bed turnover.
 */
import type { EventHandler } from "../sim/simulation.js";
import { createPatient } from "../state/patient.js";
import { drawUrgency, nextInterArrival } from "../model/arrivals.js";
import { drawProcedure } from "../config/procedures.js";
import { admitWaiting } from "./admission.js";

export const handleArrival: EventHandler = (_event, ctx) => {
    // Keep the arrival process alive before anything else can go wrong.
    const gap = nextInterArrival(
        ctx.config.arrivals.meanInterArrivalMs,
        ctx.rng.arrivals,
    );
    ctx.schedule({ kind: "arrival", time: ctx.simTime + gap });

    const urgency = drawUrgency(ctx.config.arrivals, ctx.rng.arrivals);
    const procedureId = drawProcedure(urgency, ctx.rng.arrivals);
    const id = ctx.ids.next();
    ctx.world.patients.set(
        id,
        createPatient({
            id,
            urgency,
            procedureId,
            registeredAt: ctx.simTime,
        }),
    );
    ctx.world.counters.registered += 1;
    ctx.emit({
        kind: "PatientRegistered",
        simTime: ctx.simTime,
        patientId: id,
        urgency,
        procedureId,
    });

    admitWaiting(ctx);
};
