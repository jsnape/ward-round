import { describe, expect, it, vi } from "vitest";
import type { BusinessEventJson } from "../generated/businessEvents.js";
import { ConsoleSink, HttpSink, InMemorySink } from "./sinks.js";

const sample: BusinessEventJson = {
    schemaVersion: "1.0.0",
    eventId: "e-1",
    gameId: "g-1",
    simTime: 0,
    wallTime: "2026-01-01T00:00:00.000Z",
    type: "PatientAdmitted",
    payload: { patientId: "p-1" },
};

describe("InMemorySink", () => {
    it("collects emitted events and can clear", () => {
        const sink = new InMemorySink();
        sink.emit(sample);
        sink.emit(sample);
        expect(sink.events).toHaveLength(2);
        sink.clear();
        expect(sink.events).toHaveLength(0);
    });
});

describe("ConsoleSink", () => {
    it("logs each event via the injected logger", () => {
        const log = vi.fn();
        new ConsoleSink(log).emit(sample);
        expect(log).toHaveBeenCalledOnce();
        expect(log.mock.calls[0]?.[0]).toContain("PatientAdmitted");
    });
});

describe("HttpSink", () => {
    it("is a no-op in Stage 1", () => {
        expect(() => new HttpSink().emit(sample)).not.toThrow();
    });
});
