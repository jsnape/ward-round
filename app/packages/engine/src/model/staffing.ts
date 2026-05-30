/**
 * Ward staffing model: nurse-acuity coverage and per-treatment resource
 * allocation. Pure functions — no state, no emission, no scheduling.
 *
 * Every active treatment consumes one doctor and one nurse from the free pool.
 * The free pool is the total headcount minus ward-coverage nurses (acuity floor)
 * and minus nurses already assigned to in-progress treatments.
 */
import type { ResourceState } from "../state/resources.js";

/** Minimum nurses consumed by ward-coverage duties at the given bed capacity. */
export function wardNursesNeeded(bedCapacity: number, acuity: number): number {
    return Math.ceil(bedCapacity * acuity);
}

/**
 * Doctors and nurses currently available to take on a new treatment.
 * `inTreatmentCount` is the number of patients currently in `InTreatment` state.
 */
export function freeStaff(
    resources: ResourceState,
    inTreatmentCount: number,
    acuity: number,
): { freeDoctors: number; freeNurses: number } {
    const wardNurses = wardNursesNeeded(resources.beds.capacity, acuity);
    return {
        freeDoctors: resources.doctors.headcount - inTreatmentCount,
        freeNurses: Math.max(
            0,
            resources.nurses.headcount - wardNurses - inTreatmentCount,
        ),
    };
}

/** True if a new treatment can start: at least one free doctor and one free nurse. */
export function canStartTreatment(
    freeDoctors: number,
    freeNurses: number,
): boolean {
    return freeDoctors >= 1 && freeNurses >= 1;
}

/**
 * True if nurse headcount is sufficient to cover the acuity load after adding
 * one more bed. The player cannot open a bed that would leave ward coverage short.
 */
export function canAddBed(
    currentCapacity: number,
    nurses: number,
    acuity: number,
): boolean {
    return nurses >= wardNursesNeeded(currentCapacity + 1, acuity);
}
