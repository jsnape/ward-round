import { type Rng, weightedPick } from "../rng/rng.js";
import type { Urgency } from "../state/patient.js";

export type SpecialtyId = "general_medicine";

export type ProcedureId =
    | "appendectomy"
    | "hernia_repair"
    | "cataract_surgery"
    | "colonoscopy"
    | "cholecystectomy"
    | "tonsillectomy"
    | "knee_arthroscopy"
    | "cardiac_stent"
    | "hip_replacement"
    | "lumbar_fusion";

export const PROCEDURE_IDS: readonly ProcedureId[] = [
    "appendectomy",
    "hernia_repair",
    "cataract_surgery",
    "colonoscopy",
    "cholecystectomy",
    "tonsillectomy",
    "knee_arthroscopy",
    "cardiac_stent",
    "hip_replacement",
    "lumbar_fusion",
];

export interface ProcedureDef {
    id: ProcedureId;
    displayName: string;
    baseDurationMs: number;
    complexity: "minor" | "major";
    requiredSpecialty: SpecialtyId;
    urgencyEligibility: readonly Urgency[];
    weight: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PROCEDURE_CATALOG: readonly ProcedureDef[] = [
    { id: "appendectomy",     displayName: "Appendectomy",     baseDurationMs: 1 * MS_PER_DAY,  complexity: "minor", requiredSpecialty: "general_medicine", urgencyEligibility: ["urgent", "emergency"],           weight: 1 },
    { id: "hernia_repair",    displayName: "Hernia Repair",    baseDurationMs: 1 * MS_PER_DAY,  complexity: "minor", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine", "urgent"],             weight: 1 },
    { id: "cataract_surgery", displayName: "Cataract Surgery", baseDurationMs: 1 * MS_PER_DAY,  complexity: "minor", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine"],                       weight: 1 },
    { id: "colonoscopy",      displayName: "Colonoscopy",      baseDurationMs: 1 * MS_PER_DAY,  complexity: "minor", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine", "urgent"],             weight: 1 },
    { id: "cholecystectomy",  displayName: "Cholecystectomy",  baseDurationMs: 2 * MS_PER_DAY,  complexity: "major", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine", "urgent", "emergency"], weight: 1 },
    { id: "tonsillectomy",    displayName: "Tonsillectomy",    baseDurationMs: 2 * MS_PER_DAY,  complexity: "minor", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine", "urgent"],             weight: 1 },
    { id: "knee_arthroscopy", displayName: "Knee Arthroscopy", baseDurationMs: 3 * MS_PER_DAY,  complexity: "minor", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine", "urgent"],             weight: 1 },
    { id: "cardiac_stent",    displayName: "Cardiac Stent",    baseDurationMs: 3 * MS_PER_DAY,  complexity: "major", requiredSpecialty: "general_medicine", urgencyEligibility: ["urgent", "emergency"],           weight: 1 },
    { id: "hip_replacement",  displayName: "Hip Replacement",  baseDurationMs: 7 * MS_PER_DAY,  complexity: "major", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine", "urgent"],             weight: 1 },
    { id: "lumbar_fusion",    displayName: "Lumbar Fusion",    baseDurationMs: 10 * MS_PER_DAY, complexity: "major", requiredSpecialty: "general_medicine", urgencyEligibility: ["routine", "urgent"],             weight: 1 },
];

export function getProcedure(id: ProcedureId): ProcedureDef {
    const proc = PROCEDURE_CATALOG.find((p) => p.id === id);
    if (proc === undefined) {
        throw new RangeError(`unknown procedure: ${id}`);
    }
    return proc;
}

export function drawProcedure(urgency: Urgency, rng: Rng): ProcedureId {
    const eligible = PROCEDURE_CATALOG.filter((p) =>
        (p.urgencyEligibility as readonly string[]).includes(urgency),
    );
    const weights = eligible.map((p) => p.weight);
    return eligible[weightedPick(weights, rng)]!.id;
}
