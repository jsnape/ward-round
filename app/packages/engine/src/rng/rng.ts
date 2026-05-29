/**
 * Deterministic pseudo-random number generation for the engine.
 *
 * All stochasticity in the simulation flows from a seeded RNG so that identical
 * (config + seed) inputs produce identical output — the property that makes the
 * engine testable and replayable. `Math.random()` must never be used.
 *
 * The default implementation is mulberry32: a fast, single-`uint32`-state
 * generator that is more than adequate for a game and trivially serialisable.
 */

/** A seeded random stream. Inject it everywhere randomness is needed. */
export interface Rng {
    /** Next float in the half-open interval [0, 1). */
    next(): number;
    /** Uniform integer in [0, maxExclusive). Throws if maxExclusive < 1. */
    int(maxExclusive: number): number;
    /**
     * Derive an independent sub-stream labelled by `label`. Forking is
     * deterministic in (current state, label) and does not advance this stream,
     * so concerns (arrivals, outcomes, …) stay decoupled.
     */
    fork(label: string): Rng;
    /** Current internal state (a `uint32`), for snapshotting. */
    getState(): number;
    /** Restore internal state captured by {@link getState}. */
    setState(state: number): void;
}

/** FNV-1a hash of a label, used to derive a child stream's seed. */
function hashLabel(label: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < label.length; i++) {
        h ^= label.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** mulberry32 implementation of {@link Rng}. */
export class Mulberry32Rng implements Rng {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    next(): number {
        this.state = (this.state + 0x6d2b79f5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(maxExclusive: number): number {
        if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
            throw new RangeError(
                `maxExclusive must be a positive integer: ${maxExclusive}`,
            );
        }
        return Math.floor(this.next() * maxExclusive);
    }

    fork(label: string): Rng {
        return new Mulberry32Rng((this.state ^ hashLabel(label)) >>> 0);
    }

    getState(): number {
        return this.state;
    }

    setState(state: number): void {
        this.state = state >>> 0;
    }
}

/** Convenience constructor for the default RNG. */
export function createRng(seed: number): Rng {
    return new Mulberry32Rng(seed);
}

/**
 * Picks an index in proportion to `weights` using a draw from `rng`.
 * Throws if any weight is negative or the weights do not sum to a positive
 * value. Used for the stochastic outcome roll.
 */
export function weightedPick(weights: readonly number[], rng: Rng): number {
    let total = 0;
    for (const w of weights) {
        if (w < 0) {
            throw new RangeError(`weights must be non-negative: ${w}`);
        }
        total += w;
    }
    if (total <= 0) {
        throw new RangeError("weights must sum to a positive value");
    }
    const r = rng.next() * total;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
        acc += weights[i]!;
        if (r < acc) {
            return i;
        }
    }
    return weights.length - 1;
}
