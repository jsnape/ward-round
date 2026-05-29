/**
 * The simulation clock. Owns `simTime` as integer milliseconds since the game
 * epoch (0). Time only ever moves forward: advancing to an earlier or
 * non-integer time is a programming error and throws.
 */
export class SimClock {
    private current = 0;

    /** Current simulation time, in integer milliseconds since the epoch. */
    get simTime(): number {
        return this.current;
    }

    /**
     * Advance the clock to `time`. `time` must be an integer >= the current
     * time; advancing to the same time is allowed (multiple events may share a
     * timestamp).
     */
    advanceTo(time: number): void {
        if (!Number.isInteger(time)) {
            throw new RangeError(`simTime must be an integer: ${time}`);
        }
        if (time < this.current) {
            throw new RangeError(
                `simTime must not go backwards: ${time} < ${this.current}`,
            );
        }
        this.current = time;
    }
}
