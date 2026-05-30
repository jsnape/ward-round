import { describe, expect, it } from "vitest";
import type { PortableState } from "@ward-round/engine";
import type { BusinessEventJson } from "../../generated/businessEvents.js";
import { SCHEMA_VERSION } from "../version.js";
import { type SaveFile, SAVE_VERSION, createSaveFile } from "./format.js";
import { replayLog } from "./replay.js";
import { migrate } from "./migrate.js";

const snapshot: PortableState = {
    simTime: 0,
    resources: {
        beds: { capacity: 1, occupied: 0 },
        doctors: { headcount: 1 },
        nurses: { headcount: 1 },
    },
    counters: { registered: 0, admitted: 0, discharged: 0, cancelled: 0 },
    patients: [],
};

let id = 0;
function ev<T extends BusinessEventJson["type"]>(
    type: T,
    payload: Extract<BusinessEventJson, { type: T }>["payload"],
): BusinessEventJson {
    return {
        schemaVersion: SCHEMA_VERSION,
        eventId: `e-${(id += 1)}`,
        gameId: "g-1",
        simTime: 0,
        wallTime: "2026-01-01T00:00:00.000Z",
        type,
        payload,
    } as BusinessEventJson;
}

describe("createSaveFile", () => {
    it("stamps versions and copies the log", () => {
        const log = [ev("PatientAdmitted", { patientId: "p-1" })];
        const save = createSaveFile({ gameId: "g-1", log, snapshot });
        expect(save.saveVersion).toBe(SAVE_VERSION);
        expect(save.schemaVersion).toBe(SCHEMA_VERSION);
        expect(save.gameId).toBe("g-1");
        expect(save.log).toEqual(log);
        expect(save.log).not.toBe(log); // copied
        expect(save.snapshot).toBe(snapshot);
    });

    it("survives a JSON round-trip", () => {
        const save = createSaveFile({ gameId: "g-1", log: [], snapshot });
        expect(JSON.parse(JSON.stringify(save))).toEqual(save);
    });
});

describe("replayLog", () => {
    it("folds the recorded log into a historical summary", () => {
        const log: BusinessEventJson[] = [
            ev("GameStarted", {
                mode: "NHS",
                budget: 1000,
                beds: 1,
                doctors: 1,
                nurses: 1,
            }),
            ev("PatientRegistered", {
                patientId: "p-1",
                urgency: "routine",
                procedureId: "appendectomy",
            }),
            ev("PatientAdmitted", { patientId: "p-1" }),
            ev("PatientDischarged", {
                patientId: "p-1",
                outcome: "good",
                lengthOfStay: 5,
            }),
            ev("PatientDischarged", {
                patientId: "p-2",
                outcome: "poor",
                lengthOfStay: 9,
            }),
            ev("AdmissionCancelled", {
                patientId: "p-3",
                reason: "no_bed_available",
            }),
            ev("BudgetUpdated", {
                spent: 20,
                remaining: 980,
                patientsTreated: 2,
                outcomeScore: 1,
            }),
        ];
        expect(replayLog(log)).toEqual({
            registered: 1,
            admitted: 1,
            discharged: 2,
            cancelled: 1,
            outcomes: { good: 1, complication: 0, poor: 1 },
            budget: { spent: 20, remaining: 980, outcomeScore: 1 },
        });
    });
});

describe("migrate", () => {
    const at = (saveVersion: number): SaveFile =>
        ({
            saveVersion,
            schemaVersion: SCHEMA_VERSION,
            gameId: "g-1",
            log: [],
            snapshot,
        }) as SaveFile;

    it("returns a current-version save unchanged", () => {
        expect(migrate(at(SAVE_VERSION)).saveVersion).toBe(SAVE_VERSION);
    });

    it("throws for a save newer than supported", () => {
        expect(() => migrate(at(SAVE_VERSION + 1))).toThrow(/newer/);
    });

    it("throws when no migration is registered for an old version", () => {
        expect(() => migrate(at(0), {}, 1)).toThrow(/no migration/);
    });

    it("applies registered migrations in sequence", () => {
        const migrations = {
            0: (s: SaveFile & Record<string, unknown>) => ({
                ...s,
                saveVersion: 1,
            }),
        };
        expect(migrate(at(0), migrations, 1).saveVersion).toBe(1);
    });
});
