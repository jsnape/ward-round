/**
 * The mutable world-state aggregate owned by the simulation, plus the immutable
 * read-model projected for rendering and scoring.
 *
 * `WorldState` is mutated only by handlers during a step. Consumers never touch
 * it directly; they read a freshly-projected {@link WorldStateReadModel}.
 */
import type { EngineConfig } from "../config/types.js";
import {
    type DurationClass,
    type OutcomeTier,
    type Patient,
    type Urgency,
    PatientState,
} from "./patient.js";
import {
    type ResourceState,
    createResourceState,
    freeBeds,
} from "./resources.js";

/** Running tallies maintained by handlers, surfaced for scoring and the UI. */
export interface WorldCounters {
    registered: number;
    admitted: number;
    discharged: number;
    cancelled: number;
}

export interface WorldState {
    patients: Map<string, Patient>;
    resources: ResourceState;
    simTime: number;
    counters: WorldCounters;
}

/** Builds the initial world from config: no patients, full capacity, time 0. */
export function createWorldState(config: EngineConfig): WorldState {
    return {
        patients: new Map(),
        resources: createResourceState(config.resources),
        simTime: 0,
        counters: { registered: 0, admitted: 0, discharged: 0, cancelled: 0 },
    };
}

/** A read-only view of a single patient for rendering. */
export interface PatientView {
    id: string;
    state: PatientState;
    urgency: Urgency;
    durationClass: DurationClass;
    outcome?: OutcomeTier;
}

/** A self-contained, immutable snapshot of the world for rendering/scoring. */
export interface WorldStateReadModel {
    simTime: number;
    beds: { capacity: number; occupied: number; free: number };
    doctors: number;
    nurses: number;
    waitingListLength: number;
    patients: readonly PatientView[];
    counters: WorldCounters;
}

function toView(patient: Patient): PatientView {
    const view: PatientView = {
        id: patient.id,
        state: patient.state,
        urgency: patient.urgency,
        durationClass: patient.durationClass,
    };
    if (patient.outcome !== undefined) {
        view.outcome = patient.outcome;
    }
    return view;
}

/** Projects a fresh, immutable read-model. Never exposes live internal objects. */
export function projectReadModel(world: WorldState): WorldStateReadModel {
    const patients: PatientView[] = [];
    let waitingListLength = 0;
    for (const patient of world.patients.values()) {
        if (patient.state === PatientState.WaitingList) {
            waitingListLength += 1;
        }
        patients.push(toView(patient));
    }
    return {
        simTime: world.simTime,
        beds: {
            capacity: world.resources.beds.capacity,
            occupied: world.resources.beds.occupied,
            free: freeBeds(world.resources),
        },
        doctors: world.resources.doctors.headcount,
        nurses: world.resources.nurses.headcount,
        waitingListLength,
        patients,
        counters: { ...world.counters },
    };
}
