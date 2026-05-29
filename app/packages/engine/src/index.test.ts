import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "./index.js";

describe("engine skeleton", () => {
    it("exposes a version anchor", () => {
        expect(ENGINE_VERSION).toBe("0.0.0");
    });
});
