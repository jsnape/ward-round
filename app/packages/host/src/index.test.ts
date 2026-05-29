import { describe, expect, it } from "vitest";
import { HOST_VERSION } from "./index.js";

describe("host skeleton", () => {
    it("exposes a version anchor", () => {
        expect(HOST_VERSION).toBe("0.0.0");
    });
});
