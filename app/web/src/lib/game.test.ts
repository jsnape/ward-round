import { describe, expect, it } from "vitest";
import { MS_PER_DAY } from "@ward-round/engine";
import { Game } from "./game.js";

describe("Game", () => {
    it("starts running at the default capacity and emits GameStarted", () => {
        const game = new Game();
        const snap = game.snapshot();
        expect(snap.paused).toBe(false);
        expect(snap.speed).toBe(1);
        expect(snap.state.beds.capacity).toBe(10);
        expect(snap.businessEventCount).toBeGreaterThanOrEqual(1); // GameStarted
    });

    it("advances the simulation and accrues score over time", () => {
        const game = new Game();
        // Drive ~60 sim-days worth of wall time in chunks.
        for (let i = 0; i < 200; i++) {
            game.tick(250);
        }
        const snap = game.snapshot();
        expect(snap.state.simTime).toBeGreaterThan(0);
        expect(snap.score.patientsTreated).toBeGreaterThan(0);
        expect(snap.score.totalScore).not.toBe(0);
    });

    it("pauses and resumes", () => {
        const game = new Game();
        game.togglePause();
        const before = game.tick(1000).state.simTime;
        const after = game.tick(1000).state.simTime;
        expect(before).toBe(after); // no advance while paused
        game.togglePause();
        expect(game.tick(1000).state.simTime).toBeGreaterThan(after);
    });

    it("changes speed", () => {
        const game = new Game();
        game.setSpeed(5);
        expect(game.snapshot().speed).toBe(5);
    });

    it("reallocates capacity live", () => {
        const game = new Game();
        game.setBeds(25);
        game.setDoctors(8);
        game.setNurses(12);
        const snap = game.snapshot();
        expect(snap.state.beds.capacity).toBe(25);
        expect(snap.state.doctors).toBe(8);
        expect(snap.state.nurses).toBe(12);
    });

    it("exposes the locally-emitted business-event stream", () => {
        const game = new Game();
        for (let i = 0; i < 50; i++) {
            game.tick(MS_PER_DAY / 1000); // advance via wall→sim mapping
        }
        expect(game.businessEvents.length).toBeGreaterThan(0);
        expect(game.businessEvents[0]?.type).toBe("GameStarted");
    });
});
