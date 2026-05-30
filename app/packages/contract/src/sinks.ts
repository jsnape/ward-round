/**
 * Business-event sinks. The translator emits to a {@link BusinessEventSink};
 * these are the Stage 1 implementations. The HTTP sink is a deliberate no-op —
 * posting to a server is switched on in a later stage.
 */
import type { BusinessEventJson } from "../generated/businessEvents.js";
import type { BusinessEventSink } from "./translator.js";

/** Collects events in memory — the test seam and the save-log source. */
export class InMemorySink implements BusinessEventSink {
    readonly events: BusinessEventJson[] = [];

    emit(event: BusinessEventJson): void {
        this.events.push(event);
    }

    clear(): void {
        this.events.length = 0;
    }
}

/** Logs each event via an injectable logger (defaults to console.log). */
export class ConsoleSink implements BusinessEventSink {
    constructor(private readonly log: (line: string) => void = console.log) {}

    emit(event: BusinessEventJson): void {
        this.log(`[${event.type}] ${JSON.stringify(event)}`);
    }
}

/** Switched-off sink for the (not-yet-wired) server endpoint. */
export class HttpSink implements BusinessEventSink {
    emit(_event: BusinessEventJson): void {
        // Intentionally a no-op in Stage 1: server posting is enabled later.
    }
}
