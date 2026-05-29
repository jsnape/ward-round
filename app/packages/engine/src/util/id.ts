/**
 * Deterministic id generator. Produces `prefix-1`, `prefix-2`, … so ids are
 * reproducible for a given run (never `crypto.randomUUID()`, which would break
 * determinism). The business/contract layer is responsible for any real UUIDs.
 */
export class IdGenerator {
    private n = 0;

    constructor(private readonly prefix = "p") {}

    /** Returns the next id in sequence. */
    next(): string {
        this.n += 1;
        return `${this.prefix}-${this.n}`;
    }

    /** Resets the counter, so the next id is `prefix-1` again. */
    reset(): void {
        this.n = 0;
    }
}
