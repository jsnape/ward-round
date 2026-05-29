import { describe, expect, it } from "vitest";
import {
    type DomainEvent,
    DOMAIN_EVENT_KINDS,
    isDomainEvent,
    isEventKind,
} from "./events.js";

describe("isDomainEvent", () => {
    it("accepts a well-formed event of each kind", () => {
        const samples: Partial<Record<string, unknown>> = {
            GameStarted: {
                kind: "GameStarted",
                simTime: 0,
                config: { seed: 1, beds: 1, doctors: 1, nurses: 1 },
            },
            PatientDischarged: {
                kind: "PatientDischarged",
                simTime: 5,
                patientId: "p-1",
                outcome: "good",
                lengthOfStay: 5,
            },
        };
        for (const value of Object.values(samples)) {
            expect(isDomainEvent(value)).toBe(true);
        }
    });

    it("treats every declared kind as recognised", () => {
        for (const kind of DOMAIN_EVENT_KINDS) {
            expect(isDomainEvent({ kind, simTime: 0 })).toBe(true);
        }
    });

    it("rejects non-objects", () => {
        expect(isDomainEvent(42)).toBe(false);
    });

    it("rejects null", () => {
        expect(isDomainEvent(null)).toBe(false);
    });

    it("rejects an unknown kind", () => {
        expect(isDomainEvent({ kind: "Nope", simTime: 0 })).toBe(false);
    });

    it("rejects a missing/non-string kind", () => {
        expect(isDomainEvent({ kind: 7, simTime: 0 })).toBe(false);
    });

    it("rejects a non-numeric simTime", () => {
        expect(isDomainEvent({ kind: "GameStarted", simTime: "0" })).toBe(
            false,
        );
    });
});

describe("isEventKind", () => {
    const event: DomainEvent = {
        kind: "PatientAdmitted",
        simTime: 10,
        patientId: "p-1",
    };

    it("narrows to a matching kind", () => {
        expect(isEventKind(event, "PatientAdmitted")).toBe(true);
    });

    it("rejects a non-matching kind", () => {
        expect(isEventKind(event, "PatientDischarged")).toBe(false);
    });
});
