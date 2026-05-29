/**
 * Synchronous fan-out of domain events to subscribers.
 *
 * Events are delivered within the engine step that emits them, in subscription
 * order, so the UI and the contract translator observe an ordering that matches
 * event causality. `subscribe` returns an unsubscribe function.
 */
import type { DomainEvent } from "./events.js";

export type DomainEventListener = (event: DomainEvent) => void;

export class DomainEmitter {
    private readonly listeners = new Set<DomainEventListener>();

    /** Registers a listener; returns a function that removes it. */
    subscribe(listener: DomainEventListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Delivers an event to every current listener, synchronously, in order. */
    emit(event: DomainEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}
