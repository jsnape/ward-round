import { describe, expect, it } from "vitest";
import type { DomainEvent } from "@ward-round/engine";
import type { BusinessEventJson } from "../generated/businessEvents.js";
import { SCHEMA_VERSION } from "./version.js";
import {
    type BusinessEventSink,
    type TranslatorConfig,
    createTranslator,
} from "./translator.js";

const WALL = "2026-01-01T00:00:00.000Z";

const config: TranslatorConfig = {
    budget: 1000,
    paymentPerDischarge: 10,
    outcomeScore: { good: 2, complication: 0, poor: -1 },
};

function setup() {
    const events: BusinessEventJson[] = [];
    const sink: BusinessEventSink = { emit: (e) => events.push(e) };
    let n = 0;
    const translator = createTranslator(config, {
        sink,
        gameId: "game-1",
        newEventId: () => `e-${(n += 1)}`,
        now: () => new Date(WALL),
    });
    return { events, translator };
}

describe("translator envelope + direct mappings", () => {
    it("maps GameStarted with mode and budget added", () => {
        const { events, translator } = setup();
        const domain: DomainEvent = {
            kind: "GameStarted",
            simTime: 0,
            config: { seed: 1, beds: 10, doctors: 3, nurses: 5 },
        };
        translator.handle(domain);
        expect(events).toEqual([
            {
                schemaVersion: SCHEMA_VERSION,
                eventId: "e-1",
                gameId: "game-1",
                simTime: 0,
                wallTime: WALL,
                type: "GameStarted",
                payload: {
                    mode: "NHS",
                    budget: 1000,
                    beds: 10,
                    doctors: 3,
                    nurses: 5,
                },
            },
        ]);
    });

    it("maps the per-patient lifecycle events", () => {
        const { events, translator } = setup();
        const domain: DomainEvent[] = [
            {
                kind: "PatientRegistered",
                simTime: 1,
                patientId: "p-1",
                urgency: "routine",
                durationClass: "short",
            },
            {
                kind: "PatientScheduled",
                simTime: 2,
                patientId: "p-1",
                scheduledFor: 2,
            },
            { kind: "PatientAdmitted", simTime: 3, patientId: "p-1" },
            {
                kind: "TreatmentStarted",
                simTime: 4,
                patientId: "p-1",
                expectedDuration: 100,
            },
            {
                kind: "AdmissionCancelled",
                simTime: 5,
                patientId: "p-2",
                reason: "no_bed_available",
            },
        ];
        domain.forEach((e) => translator.handle(e));
        expect(events.map((e) => e.type)).toEqual([
            "PatientRegistered",
            "PatientScheduled",
            "PatientAdmitted",
            "TreatmentStarted",
            "AdmissionCancelled",
        ]);
        expect(events[4]?.payload).toEqual({
            patientId: "p-2",
            reason: "no_bed_available",
        });
    });

    it("ignores engine-internal events not in the contract", () => {
        const { events, translator } = setup();
        translator.handle({
            kind: "BedSeized",
            simTime: 1,
            patientId: "p-1",
            bedsFree: 9,
        });
        translator.handle({
            kind: "OutcomeRolled",
            simTime: 2,
            patientId: "p-1",
            outcome: "good",
        });
        expect(events).toEqual([]);
    });
});

describe("translator derived BudgetUpdated", () => {
    it("accumulates spend, count, and outcome score per discharge", () => {
        const { events, translator } = setup();
        translator.handle({
            kind: "PatientDischarged",
            simTime: 10,
            patientId: "p-1",
            outcome: "good",
            lengthOfStay: 5,
        });
        translator.handle({
            kind: "PatientDischarged",
            simTime: 20,
            patientId: "p-2",
            outcome: "poor",
            lengthOfStay: 9,
        });

        const budgets = events.filter((e) => e.type === "BudgetUpdated");
        expect(budgets).toHaveLength(2);
        expect(budgets[0]?.payload).toEqual({
            spent: 10,
            remaining: 990,
            patientsTreated: 1,
            outcomeScore: 2,
        });
        expect(budgets[1]?.payload).toEqual({
            spent: 20,
            remaining: 980,
            patientsTreated: 2,
            outcomeScore: 1, // 2 (good) + -1 (poor)
        });
    });
});

describe("translator defaults", () => {
    it("generates a gameId and event ids when not injected", () => {
        const events: BusinessEventJson[] = [];
        const translator = createTranslator(config, {
            sink: { emit: (e) => events.push(e) },
        });
        translator.handle({
            kind: "GameStarted",
            simTime: 0,
            config: { seed: 1, beds: 1, doctors: 1, nurses: 1 },
        });
        const event = events[0];
        expect(event?.gameId).toMatch(/[0-9a-f-]{36}/);
        expect(event?.eventId).toMatch(/[0-9a-f-]{36}/);
        expect(Number.isNaN(Date.parse(event?.wallTime ?? ""))).toBe(false);
    });
});
