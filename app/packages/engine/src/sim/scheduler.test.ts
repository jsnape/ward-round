import { describe, expect, it } from "vitest";
import { EventScheduler } from "./scheduler.js";

describe("EventScheduler", () => {
    it("is empty initially", () => {
        const s = new EventScheduler();
        expect(s.size).toBe(0);
        expect(s.peek()).toBeUndefined();
        expect(s.pop()).toBeUndefined();
    });

    it("pops events in ascending time order", () => {
        const s = new EventScheduler();
        s.schedule({ kind: "discharge", time: 30, patientId: "p-3" });
        s.schedule({ kind: "discharge", time: 10, patientId: "p-1" });
        s.schedule({ kind: "discharge", time: 20, patientId: "p-2" });
        expect(s.size).toBe(3);
        expect(s.pop()?.time).toBe(10);
        expect(s.pop()?.time).toBe(20);
        expect(s.pop()?.time).toBe(30);
    });

    it("breaks ties by insertion order (FIFO seq)", () => {
        const s = new EventScheduler();
        s.schedule({ kind: "discharge", time: 5, patientId: "first" });
        s.schedule({ kind: "discharge", time: 5, patientId: "second" });
        s.schedule({ kind: "discharge", time: 5, patientId: "third" });
        const order = [s.pop(), s.pop(), s.pop()].map((e) =>
            e !== undefined && "patientId" in e ? e.patientId : undefined,
        );
        expect(order).toEqual(["first", "second", "third"]);
    });

    it("peek returns the earliest without removing it", () => {
        const s = new EventScheduler();
        s.schedule({ kind: "arrival", time: 42 });
        expect(s.peek()?.time).toBe(42);
        expect(s.size).toBe(1);
    });
});
