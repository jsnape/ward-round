import { describe, expect, it } from "vitest";
import type { DomainEvent } from "./events.js";
import { DomainEmitter } from "./emitter.js";

const ev = (simTime: number): DomainEvent => ({
    kind: "PatientAdmitted",
    simTime,
    patientId: "p-1",
});

describe("DomainEmitter", () => {
    it("delivers to multiple subscribers in subscription order", () => {
        const emitter = new DomainEmitter();
        const calls: string[] = [];
        emitter.subscribe(() => calls.push("a"));
        emitter.subscribe(() => calls.push("b"));
        emitter.emit(ev(1));
        expect(calls).toEqual(["a", "b"]);
    });

    it("delivers events in emission order to a subscriber", () => {
        const emitter = new DomainEmitter();
        const seen: number[] = [];
        emitter.subscribe((e) => seen.push(e.simTime));
        emitter.emit(ev(1));
        emitter.emit(ev(2));
        emitter.emit(ev(3));
        expect(seen).toEqual([1, 2, 3]);
    });

    it("stops delivering after unsubscribe", () => {
        const emitter = new DomainEmitter();
        const seen: number[] = [];
        const unsubscribe = emitter.subscribe((e) => seen.push(e.simTime));
        emitter.emit(ev(1));
        unsubscribe();
        emitter.emit(ev(2));
        expect(seen).toEqual([1]);
    });

    it("is a no-op with no subscribers", () => {
        const emitter = new DomainEmitter();
        expect(() => emitter.emit(ev(1))).not.toThrow();
    });
});
