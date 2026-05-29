/**
 * The discrete-event scheduler: a timestamp-ordered queue of future events,
 * backed by `tinyqueue`. Events are ordered by `time`, ties broken by an
 * insertion sequence number so same-timestamp events fire FIFO — this tiebreak
 * is what keeps the simulation deterministic.
 *
 * Events carry ids (a `patientId`), never object references, so the queue stays
 * serialisable and handlers re-resolve current state at execution time.
 */
import TinyQueue from "tinyqueue";

export type EventKind =
    | "arrival"
    | "treatmentComplete"
    | "discharge"
    | "bedManagerRound";

/** A queued event, with its assigned FIFO sequence number. */
export type ScheduledEvent =
    | { kind: "arrival"; time: number; seq: number }
    | {
          kind: "treatmentComplete";
          time: number;
          seq: number;
          patientId: string;
      }
    | { kind: "discharge"; time: number; seq: number; patientId: string }
    | { kind: "bedManagerRound"; time: number; seq: number };

/** What a caller provides to {@link EventScheduler.schedule}; `seq` is assigned. */
export type ScheduledEventInput =
    | { kind: "arrival"; time: number }
    | { kind: "treatmentComplete"; time: number; patientId: string }
    | { kind: "discharge"; time: number; patientId: string }
    | { kind: "bedManagerRound"; time: number };

export class EventScheduler {
    private readonly queue = new TinyQueue<ScheduledEvent>(
        [],
        (a, b) => a.time - b.time || a.seq - b.seq,
    );
    private nextSeq = 0;

    /** Schedules an event, stamping it with the next FIFO sequence number. */
    schedule(event: ScheduledEventInput): void {
        const stamped = { ...event, seq: this.nextSeq } as ScheduledEvent;
        this.nextSeq += 1;
        this.queue.push(stamped);
    }

    /** The earliest event without removing it. */
    peek(): ScheduledEvent | undefined {
        return this.queue.peek();
    }

    /** Removes and returns the earliest event. */
    pop(): ScheduledEvent | undefined {
        return this.queue.pop();
    }

    get size(): number {
        return this.queue.length;
    }
}
