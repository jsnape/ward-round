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
