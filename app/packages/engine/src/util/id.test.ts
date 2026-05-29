import { describe, expect, it } from "vitest";
import { IdGenerator } from "./id.js";

describe("IdGenerator", () => {
    it("produces a deterministic sequence with the default prefix", () => {
        const ids = new IdGenerator();
        expect([ids.next(), ids.next(), ids.next()]).toEqual([
            "p-1",
            "p-2",
            "p-3",
        ]);
    });

    it("honours a custom prefix", () => {
        const ids = new IdGenerator("bed");
        expect(ids.next()).toBe("bed-1");
    });

    it("restarts from one after reset", () => {
        const ids = new IdGenerator();
        ids.next();
        ids.next();
        ids.reset();
        expect(ids.next()).toBe("p-1");
    });
});
