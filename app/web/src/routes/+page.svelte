<script lang="ts">
    import { onMount } from "svelte";
    import {
        Activity,
        BedDouble,
        Pause,
        Play,
        Stethoscope,
        UserRound,
    } from "@lucide/svelte";
    import { SPEED_PRESETS } from "@ward-round/host";
    import { Game, type GameSnapshot } from "$lib/game";
    import { formatSimTime } from "$lib/format";

    const game = new Game();
    let snap = $state<GameSnapshot>(game.snapshot());

    onMount(() => {
        let last = performance.now();
        let frame = 0;
        const loop = (now: number) => {
            const delta = now - last;
            last = now;
            snap = game.tick(delta);
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    });

    function refresh() {
        snap = game.snapshot();
    }
    function togglePause() {
        game.togglePause();
        refresh();
    }
    function setSpeed(speed: number) {
        game.setSpeed(speed);
        refresh();
    }
    function adjustBeds(delta: number) {
        game.setBeds(Math.max(0, snap.state.beds.capacity + delta));
        refresh();
    }
    function adjustDoctors(delta: number) {
        game.setDoctors(Math.max(0, snap.state.doctors + delta));
        refresh();
    }
    function adjustNurses(delta: number) {
        game.setNurses(Math.max(0, snap.state.nurses + delta));
        refresh();
    }

    const bedCells = $derived(
        Array.from({ length: snap.state.beds.capacity }, (_, i) => ({
            id: i,
            occupied: i < snap.state.beds.occupied,
        })),
    );
</script>

<main class="mx-auto min-h-screen max-w-5xl bg-slate-50 p-6 text-slate-900">
    <header class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <Activity class="h-7 w-7 text-rose-600" />
            <h1 class="text-2xl font-semibold tracking-tight">Ward Round</h1>
        </div>
        <div class="flex items-center gap-4">
            <span data-testid="clock" class="font-mono text-lg text-slate-600">
                {formatSimTime(snap.state.simTime)}
            </span>
            <button
                data-testid="pause-toggle"
                class="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                onclick={togglePause}
            >
                {#if snap.paused}
                    <Play class="h-4 w-4" /> Resume
                {:else}
                    <Pause class="h-4 w-4" /> Pause
                {/if}
            </button>
            <div class="flex overflow-hidden rounded border border-slate-300">
                {#each SPEED_PRESETS as preset (preset)}
                    <button
                        data-testid={`speed-${preset}`}
                        class="px-2.5 py-1.5 text-sm {snap.speed === preset
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'}"
                        onclick={() => setSpeed(preset)}
                    >
                        {preset}×
                    </button>
                {/each}
            </div>
        </div>
    </header>

    <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-medium text-slate-500">Waiting list</h2>
            <p
                data-testid="waiting-count"
                class="mt-1 text-4xl font-bold text-amber-600"
            >
                {snap.state.waitingListLength}
            </p>
            <p class="mt-1 text-xs text-slate-400">patients awaiting a bed</p>
        </div>

        <div
            class="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2"
        >
            <div class="flex items-center justify-between">
                <h2
                    class="flex items-center gap-1.5 text-sm font-medium text-slate-500"
                >
                    <BedDouble class="h-4 w-4" /> Beds
                </h2>
                <span class="text-sm text-slate-600">
                    <span data-testid="beds-occupied"
                        >{snap.state.beds.occupied}</span
                    >
                    /
                    <span data-testid="beds-capacity"
                        >{snap.state.beds.capacity}</span
                    > occupied
                </span>
            </div>
            <div class="mt-3 flex flex-wrap gap-1">
                {#each bedCells as cell (cell.id)}
                    <span
                        class="h-3 w-3 rounded-sm {cell.occupied
                            ? 'bg-rose-500'
                            : 'bg-slate-200'}"
                    ></span>
                {/each}
            </div>
            <div class="mt-3 flex items-center gap-2 text-sm">
                <span class="text-slate-500">Adjust beds:</span>
                <button
                    data-testid="beds-dec"
                    class="rounded border border-slate-300 px-2 hover:bg-slate-100"
                    onclick={() => adjustBeds(-1)}>−</button
                >
                <button
                    data-testid="beds-inc"
                    class="rounded border border-slate-300 px-2 hover:bg-slate-100"
                    onclick={() => adjustBeds(1)}>+</button
                >
            </div>
        </div>
    </section>

    <section class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2
                class="flex items-center gap-1.5 text-sm font-medium text-slate-500"
            >
                <Stethoscope class="h-4 w-4" /> Doctors
            </h2>
            <p data-testid="doctors" class="mt-1 text-2xl font-bold">
                {snap.state.doctors}
            </p>
            <div class="mt-2 flex gap-2 text-sm">
                <button
                    data-testid="doctors-dec"
                    class="rounded border border-slate-300 px-2 hover:bg-slate-100"
                    onclick={() => adjustDoctors(-1)}>−</button
                >
                <button
                    data-testid="doctors-inc"
                    class="rounded border border-slate-300 px-2 hover:bg-slate-100"
                    onclick={() => adjustDoctors(1)}>+</button
                >
            </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2
                class="flex items-center gap-1.5 text-sm font-medium text-slate-500"
            >
                <UserRound class="h-4 w-4" /> Nurses
            </h2>
            <p data-testid="nurses" class="mt-1 text-2xl font-bold">
                {snap.state.nurses}
            </p>
            <div class="mt-2 flex gap-2 text-sm">
                <button
                    data-testid="nurses-dec"
                    class="rounded border border-slate-300 px-2 hover:bg-slate-100"
                    onclick={() => adjustNurses(-1)}>−</button
                >
                <button
                    data-testid="nurses-inc"
                    class="rounded border border-slate-300 px-2 hover:bg-slate-100"
                    onclick={() => adjustNurses(1)}>+</button
                >
            </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-medium text-slate-500">Treated</h2>
            <p
                data-testid="patients-treated"
                class="mt-1 text-2xl font-bold text-emerald-600"
            >
                {snap.score.patientsTreated}
            </p>
            <p class="text-xs text-slate-400">
                cancelled:
                <span data-testid="cancelled"
                    >{snap.state.counters.cancelled}</span
                >
            </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-medium text-slate-500">NHS score</h2>
            <p
                data-testid="score-total"
                class="mt-1 text-2xl font-bold text-rose-600"
            >
                {snap.score.totalScore}
            </p>
            <p class="text-xs text-slate-400">
                budget left:
                <span data-testid="remaining">{snap.score.remaining}</span>
            </p>
        </div>
    </section>
</main>
