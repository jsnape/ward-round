/**
 * The framework-agnostic simulation driver. It maps real (wall-clock) time onto
 * simulation time and pumps the engine via `runUntil`. It holds pause/speed
 * state but touches no DOM — a host (the web app) feeds it wall-clock deltas
 * from a requestAnimationFrame loop. Pure arithmetic, so it tests to 100%.
 */
import type {
    DomainEventListener,
    Simulation,
    WorldStateReadModel,
} from "@ward-round/engine";

/** Selectable speed multipliers offered to the UI. */
export const SPEED_PRESETS = [1, 2, 5] as const;

/** Default mapping: 1 real second advances 1 simulated day (a watchable pace). */
export const DEFAULT_SIM_MS_PER_WALL_MS = (24 * 60 * 60 * 1000) / 1000;

export interface SimDriverOptions {
    /** Simulated milliseconds advanced per real millisecond (before speed). */
    simMsPerWallMs?: number;
    /** Initial speed multiplier. */
    speed?: number;
}

export class SimDriver {
    private readonly simMsPerWallMs: number;
    private currentSpeed: number;
    private isPaused = false;

    constructor(
        private readonly sim: Simulation,
        options: SimDriverOptions = {},
    ) {
        this.simMsPerWallMs =
            options.simMsPerWallMs ?? DEFAULT_SIM_MS_PER_WALL_MS;
        this.currentSpeed = options.speed ?? 1;
    }

    get simTime(): number {
        return this.sim.simTime;
    }

    get paused(): boolean {
        return this.isPaused;
    }

    get speed(): number {
        return this.currentSpeed;
    }

    get state(): WorldStateReadModel {
        return this.sim.state;
    }

    start(): void {
        this.sim.start();
    }

    subscribe(listener: DomainEventListener): () => void {
        return this.sim.subscribe(listener);
    }

    pause(): void {
        this.isPaused = true;
    }

    resume(): void {
        this.isPaused = false;
    }

    setSpeed(speed: number): void {
        if (speed <= 0) {
            throw new RangeError(`speed must be positive: ${speed}`);
        }
        this.currentSpeed = speed;
    }

    /**
     * Advance the simulation by a real-time delta (ms). Returns the number of
     * events processed. No-op while paused or for a non-positive delta.
     */
    tick(wallDeltaMs: number): number {
        if (this.isPaused || wallDeltaMs <= 0) {
            return 0;
        }
        const budget = Math.floor(
            wallDeltaMs * this.simMsPerWallMs * this.currentSpeed,
        );
        if (budget <= 0) {
            return 0;
        }
        return this.sim.runUntil(this.sim.simTime + budget);
    }
}
