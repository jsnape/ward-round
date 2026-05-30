const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Formats a simulation timestamp (integer milliseconds since game epoch) as a
 * human-readable `Day N HH:MM` clock. Pure; used by the UI to render sim time.
 */
export function formatSimTime(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError(
            `simTime must be a finite, non-negative number: ${ms}`,
        );
    }
    const totalMinutes = Math.floor(ms / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    return `Day ${days} ${hh}:${mm}`;
}

/** Formats the wait duration between registeredAt and simTime as "Xd Yh" or "Yh". */
export function formatWaitDays(registeredAt: number, simTime: number): string {
    const elapsed = Math.max(0, simTime - registeredAt);
    const days = Math.floor(elapsed / MS_PER_DAY);
    const hours = Math.floor((elapsed % MS_PER_DAY) / MS_PER_HOUR);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
}

/**
 * Returns treatment progress as an integer 0–100, clamped.
 * Returns 0 if the interval is degenerate (endAt <= startAt).
 */
export function formatProgress(startAt: number, endAt: number, simTime: number): number {
    if (endAt <= startAt) return 0;
    const raw = (simTime - startAt) / (endAt - startAt);
    return Math.min(100, Math.max(0, Math.round(raw * 100)));
}
