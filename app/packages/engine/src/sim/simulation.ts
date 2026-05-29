/**
 * The simulation orchestrator: wires the clock, scheduler, world state, RNG
 * streams, id generator, and domain-event emitter, and exposes the synchronous
 * advancement API (`step`, `runUntil`, `run`). It owns no lifecycle logic — that
 * lives in injected handlers (one per event kind, wired in §6). This keeps the
 * orchestration generic and fully testable in isolation.
 */
import type { EngineConfig } from "../config/types.js";
import { type DomainEvent } from "../domain/events.js";
import { type DomainEventListener, DomainEmitter } from "../domain/emitter.js";
import { type Rng, createRng } from "../rng/rng.js";
import { IdGenerator } from "../util/id.js";
import { SimClock } from "./clock.js";
import {
    type EventKind,
    type ScheduledEvent,
    type ScheduledEventInput,
    EventScheduler,
} from "./scheduler.js";
import {
    type WorldState,
    type WorldStateReadModel,
    createWorldState,
    projectReadModel,
} from "../state/worldState.js";

/** What a handler is given: current state, RNG streams, and ways to act. */
export interface SimContext {
    readonly simTime: number;
    readonly world: WorldState;
    readonly config: EngineConfig;
    readonly rng: { readonly arrivals: Rng; readonly outcomes: Rng };
    readonly ids: IdGenerator;
    /** Schedule a follow-on event. */
    schedule(event: ScheduledEventInput): void;
    /** Emit a domain event to subscribers. */
    emit(event: DomainEvent): void;
}

/** Processes one scheduled event of its kind, mutating state and emitting events. */
export type EventHandler = (event: ScheduledEvent, ctx: SimContext) => void;

/** Handlers keyed by event kind. Unregistered kinds throw when encountered. */
export type HandlerRegistry = Partial<Record<EventKind, EventHandler>>;

/** Dependencies injected into a simulation; all optional with safe defaults. */
export interface SimulationDeps {
    handlers?: HandlerRegistry;
    /** Seeds the initial event(s); run once by {@link Simulation.start}. */
    bootstrap?: (ctx: SimContext) => void;
    /** Safety bound for a single {@link Simulation.runUntil} call. */
    maxIterations?: number;
}

/** The public simulation surface consumed by hosts, scoring, and the contract. */
export interface Simulation {
    readonly simTime: number;
    /** Emit `GameStarted` and seed initial events. Idempotent. */
    start(): void;
    /** Advance exactly one event; false if the queue is empty. */
    step(): boolean;
    /** Process every event with `time <= until`, then leave `simTime === until`. */
    runUntil(until: number): number;
    /** Advance up to `maxEvents` events (default: to quiescence). */
    run(maxEvents?: number): number;
    subscribe(listener: DomainEventListener): () => void;
    readonly state: WorldStateReadModel;
}

const DEFAULT_MAX_ITERATIONS = 1_000_000;

class SimulationImpl implements Simulation {
    private readonly clock = new SimClock();
    private readonly scheduler = new EventScheduler();
    private readonly emitter = new DomainEmitter();
    private readonly world: WorldState;
    private readonly rngArrivals: Rng;
    private readonly rngOutcomes: Rng;
    private readonly ids = new IdGenerator();
    private readonly handlers: HandlerRegistry;
    private readonly bootstrap: ((ctx: SimContext) => void) | undefined;
    private readonly maxIterations: number;
    private started = false;

    constructor(
        private readonly config: EngineConfig,
        deps: SimulationDeps,
    ) {
        this.world = createWorldState(config);
        const root = createRng(config.seed);
        this.rngArrivals = root.fork("arrivals");
        this.rngOutcomes = root.fork("outcomes");
        this.handlers = deps.handlers ?? {};
        this.bootstrap = deps.bootstrap;
        this.maxIterations = deps.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    }

    get simTime(): number {
        return this.clock.simTime;
    }

    get state(): WorldStateReadModel {
        return projectReadModel(this.world);
    }

    subscribe(listener: DomainEventListener): () => void {
        return this.emitter.subscribe(listener);
    }

    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        this.emitter.emit({
            kind: "GameStarted",
            simTime: this.clock.simTime,
            config: {
                seed: this.config.seed,
                beds: this.config.resources.beds,
                doctors: this.config.resources.doctors,
                nurses: this.config.resources.nurses,
            },
        });
        this.bootstrap?.(this.makeContext());
    }

    step(): boolean {
        const event = this.scheduler.pop();
        if (event === undefined) {
            return false;
        }
        this.clock.advanceTo(event.time);
        this.world.simTime = event.time;
        const handler = this.handlers[event.kind];
        if (handler === undefined) {
            throw new Error(
                `no handler registered for event kind: ${event.kind}`,
            );
        }
        handler(event, this.makeContext());
        return true;
    }

    runUntil(until: number): number {
        let processed = 0;
        let iterations = 0;
        for (;;) {
            const next = this.scheduler.peek();
            if (next === undefined || next.time > until) {
                break;
            }
            iterations += 1;
            if (iterations > this.maxIterations) {
                throw new Error(
                    "runUntil exceeded max iterations (same-timestamp storm?)",
                );
            }
            this.step();
            processed += 1;
        }
        if (until > this.clock.simTime) {
            this.clock.advanceTo(until);
            this.world.simTime = until;
        }
        return processed;
    }

    run(maxEvents = Number.POSITIVE_INFINITY): number {
        let processed = 0;
        while (processed < maxEvents && this.step()) {
            processed += 1;
        }
        return processed;
    }

    private makeContext(): SimContext {
        return {
            simTime: this.clock.simTime,
            world: this.world,
            config: this.config,
            rng: { arrivals: this.rngArrivals, outcomes: this.rngOutcomes },
            ids: this.ids,
            schedule: (event) => this.scheduler.schedule(event),
            emit: (event) => this.emitter.emit(event),
        };
    }
}

/**
 * Creates a simulation. `deps` injects the lifecycle handlers and bootstrap;
 * with no deps the simulation only emits `GameStarted` and otherwise idles
 * (the ward handlers are wired in §6).
 */
export function createSimulation(
    config: EngineConfig,
    deps: SimulationDeps = {},
): Simulation {
    return new SimulationImpl(config, deps);
}
