import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION } from "./index.js";

describe("contract skeleton", () => {
    it("exposes a version anchor", () => {
        expect(CONTRACT_VERSION).toBe("0.0.0");
    });
});
