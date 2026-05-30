/**
 * The game controller: wires the engine, the host driver, the scoring read-layer,
 * and the contract translator into one object the UI drives. Framework-agnostic
 * (no Svelte, no DOM) so it is unit-testable; the Svelte page is a thin shell
 * that feeds it animation-frame deltas and renders its snapshots.
 */
import {
    type EngineConfig,
    type Simulation,
    type WorldStateReadModel,
    DEFAULT_ENGINE_CONFIG,
    createWardSimulation,
    canAddBed as checkCanAddBed,
} from "@ward-round/engine";
import { SimDriver } from "@ward-round/host";
import {
    type BusinessEventJson,
    InMemorySink,
    createTranslator,
} from "@ward-round/contract";
import {
    type Score,
    type BottleneckAnalysis,
    DEFAULT_SCORING_CONFIG,
    scoreState,
    analyseBottleneck,
    computeThroughputRate,
} from "@ward-round/scoring";

export interface GameSnapshot {
    state: WorldStateReadModel;
    score: Score;
    businessEventCount: number;
    paused: boolean;
    speed: number;
    bottleneck: BottleneckAnalysis;
    throughputPerDay: number;
    canAddBed: boolean;
    queueGrowing: boolean;
}

export class Game {
    private readonly sim: Simulation;
    private readonly driver: SimDriver;
    private readonly sink = new InMemorySink();
    private readonly config: EngineConfig;
    private prevWaitingListLength = 0;

    constructor(config: EngineConfig = DEFAULT_ENGINE_CONFIG) {
        this.config = config;
        this.sim = createWardSimulation(config);
        this.driver = new SimDriver(this.sim);
        const translator = createTranslator(
            {
                budget: DEFAULT_SCORING_CONFIG.budget,
                paymentPerDischarge: DEFAULT_SCORING_CONFIG.paymentPerDischarge,
                outcomeScore: DEFAULT_SCORING_CONFIG.outcomeScore,
                dailyDoctorCost: DEFAULT_SCORING_CONFIG.dailyDoctorCost,
                dailyNurseCost: DEFAULT_SCORING_CONFIG.dailyNurseCost,
                dailyBedCost: DEFAULT_SCORING_CONFIG.dailyBedCost,
            },
            { sink: this.sink },
        );
        // Subscribe before start() so the GameStarted event is captured.
        this.sim.subscribe((event) => translator.handle(event));
        this.driver.start();
    }

    /** Advance by a real-time delta (ms) and return the latest snapshot. */
    tick(wallDeltaMs: number): GameSnapshot {
        this.driver.tick(wallDeltaMs);
        const snap = this.snapshot();
        this.prevWaitingListLength = snap.state.waitingListLength;
        return snap;
    }

    snapshot(): GameSnapshot {
        const state = this.driver.state;
        return {
            state,
            score: scoreState(state),
            businessEventCount: this.sink.events.length,
            paused: this.driver.paused,
            speed: this.driver.speed,
            bottleneck: analyseBottleneck(state, this.config.ward.acuity),
            throughputPerDay: computeThroughputRate(
                state.counters.discharged,
                state.simTime,
            ),
            canAddBed: checkCanAddBed(
                state.beds.capacity,
                state.nurses,
                this.config.ward.acuity,
            ),
            queueGrowing:
                state.waitingListLength > this.prevWaitingListLength,
        };
    }

    togglePause(): void {
        if (this.driver.paused) {
            this.driver.resume();
        } else {
            this.driver.pause();
        }
    }

    setSpeed(speed: number): void {
        this.driver.setSpeed(speed);
    }

    setBeds(capacity: number): void {
        this.sim.setBeds(capacity);
    }

    setDoctors(headcount: number): void {
        this.sim.setDoctors(headcount);
    }

    setNurses(headcount: number): void {
        this.sim.setNurses(headcount);
    }

    get businessEvents(): readonly BusinessEventJson[] {
        return this.sink.events;
    }
}
