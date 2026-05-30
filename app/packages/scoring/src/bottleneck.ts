import {
    type WorldStateReadModel,
    PatientState,
    wardNursesNeeded,
} from "@ward-round/engine";

export type BottleneckKind = "beds" | "doctors" | "nurses" | "balanced";

export interface BottleneckAnalysis {
    kind: BottleneckKind;
    bedUtilisation: number;
    freeDoctors: number;
    freeNurses: number;
    wardNursesNeeded: number;
    stalledPatients: number;
}

/**
 * Determines which resource is currently the primary constraint on throughput.
 * `acuity` is the nurses-per-bed ratio from engine config (e.g. 0.5).
 */
export function analyseBottleneck(
    state: WorldStateReadModel,
    acuity: number,
): BottleneckAnalysis {
    const inTreatmentCount = state.patients.filter(
        (p) => p.state === PatientState.InTreatment,
    ).length;
    const nursesForWard = wardNursesNeeded(state.beds.capacity, acuity);
    const freeDoctors = state.doctors - inTreatmentCount;
    const freeNurses = Math.max(
        0,
        state.nurses - nursesForWard - inTreatmentCount,
    );
    const stalledPatients = state.patients.filter(
        (p) => p.state === PatientState.Admitted,
    ).length;
    const bedUtilisation =
        state.beds.capacity > 0
            ? state.beds.occupied / state.beds.capacity
            : 0;

    let kind: BottleneckKind;
    if (stalledPatients > 0 && freeDoctors < 1) {
        kind = "doctors";
    } else if (stalledPatients > 0 && freeNurses < 1) {
        kind = "nurses";
    } else if (bedUtilisation >= 0.9 && state.waitingListLength > 0) {
        kind = "beds";
    } else if (freeDoctors === 0) {
        kind = "doctors";
    } else if (freeNurses === 0) {
        kind = "nurses";
    } else {
        kind = "balanced";
    }

    return {
        kind,
        bedUtilisation,
        freeDoctors,
        freeNurses,
        wardNursesNeeded: nursesForWard,
        stalledPatients,
    };
}
