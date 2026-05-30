/**
 * The versioned save file: the contract-owned container that pairs the
 * historical business-event log with a portable forward-continuation snapshot.
 * Past state reconstructs from the log (outcomes are recorded, never re-rolled);
 * the snapshot lets a (possibly newer) engine continue the game forward.
 */
import type { PortableState } from "@ward-round/engine";
import type { BusinessEventJson } from "../../generated/businessEvents.js";
import { SCHEMA_VERSION } from "../version.js";

/** Bumped when the save-file structure changes (independent of schemaVersion). */
export const SAVE_VERSION = 1;

export interface SaveFile {
    saveVersion: number;
    schemaVersion: string;
    gameId: string;
    log: BusinessEventJson[];
    snapshot: PortableState;
}

export function createSaveFile(args: {
    gameId: string;
    log: readonly BusinessEventJson[];
    snapshot: PortableState;
}): SaveFile {
    return {
        saveVersion: SAVE_VERSION,
        schemaVersion: SCHEMA_VERSION,
        gameId: args.gameId,
        log: [...args.log],
        snapshot: args.snapshot,
    };
}
