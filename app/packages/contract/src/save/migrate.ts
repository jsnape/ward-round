/**
 * Save-file migration. As the save structure evolves, register a migration from
 * each old version to the next; `migrate` applies them in sequence up to the
 * current {@link SAVE_VERSION}. Stage 1 has only one version, so the registry is
 * empty — but the machinery (and its failure modes) are in place and tested.
 *
 * Migrations are injectable so they can be exercised in isolation.
 */
import { type SaveFile, SAVE_VERSION } from "./format.js";

type AnySave = SaveFile & Record<string, unknown>;

/** Maps a from-version to a function producing the next version's shape. */
export type SaveMigrations = Record<number, (save: AnySave) => AnySave>;

/** Registered migrations. Empty until a second save version exists. */
export const MIGRATIONS: SaveMigrations = {};

export function migrate(
    save: SaveFile,
    migrations: SaveMigrations = MIGRATIONS,
    targetVersion: number = SAVE_VERSION,
): SaveFile {
    let current = save as AnySave;
    if (current.saveVersion > targetVersion) {
        throw new Error(
            `save version ${current.saveVersion} is newer than supported (${targetVersion})`,
        );
    }
    while (current.saveVersion < targetVersion) {
        const step = migrations[current.saveVersion];
        if (step === undefined) {
            throw new Error(
                `no migration registered from save version ${current.saveVersion}`,
            );
        }
        current = step(current);
    }
    return current;
}
