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
    import { getProcedure } from "@ward-round/engine";
    import { Game, type GameSnapshot } from "$lib/game";
    import { formatSimTime } from "$lib/format";
    import InpatientCard from "$lib/InpatientCard.svelte";
    import WaitingPatientRow from "$lib/WaitingPatientRow.svelte";
    import BottleneckBadge from "$lib/BottleneckBadge.svelte";

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
        if (delta > 0 && !snap.canAddBed) return;
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

    const inpatients = $derived(
        snap.state.patients
            .filter(
                (p) =>
                    p.state === "Admitted" ||
                    p.state === "InTreatment" ||
                    p.state === "ReadyForDischarge" ||
                    p.state === "Scheduled",
            )
            .sort(
                (a, b) =>
                    (a.admittedAt ?? Infinity) - (b.admittedAt ?? Infinity),
            ),
    );

    const waitingPatients = $derived(
        snap.state.patients
            .filter((p) => p.state === "WaitingList")
            .sort((a, b) => a.registeredAt - b.registeredAt),
    );

    const freeBeds = $derived(
        Math.max(0, snap.state.beds.capacity - inpatients.length),
    );

    const bedUtilPct = $derived(
        Math.round(snap.bottleneck.bedUtilisation * 100),
    );

    const bedUtilClass = $derived(
        bedUtilPct >= 95
            ? "bg-red-500"
            : bedUtilPct >= 80
              ? "bg-amber-500"
              : "bg-emerald-500",
    );

    const nurseSplit = $derived({
        ward: snap.bottleneck.wardNursesNeeded,
        procedures: snap.state.nurses - snap.bottleneck.wardNursesNeeded - snap.bottleneck.freeNurses,
        free: snap.bottleneck.freeNurses,
    });

    const throughputDisplay = $derived(
        snap.throughputPerDay > 0
            ? snap.throughputPerDay.toFixed(1)
            : "—",
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

    <!-- Resource overview row -->
    <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <!-- Beds -->
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between">
                <h2 class="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                    <BedDouble class="h-4 w-4" /> Beds
                </h2>
                <BottleneckBadge bottleneck={snap.bottleneck} />
            </div>
            <p class="mt-1 text-2xl font-bold">
                <span data-testid="beds-occupied">{snap.state.beds.occupied}</span
                >/<span data-testid="beds-capacity">{snap.state.beds.capacity}</span>
            </p>
            <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                    class="h-full rounded-full transition-all {bedUtilClass}"
                    style="width: {bedUtilPct}%"
                ></div>
            </div>
            <div class="mt-2 flex items-center gap-2 text-sm">
                <span class="text-slate-500">Adjust:</span>
                <button
                    data-testid="beds-dec"
                    class="rounded border border-slate-300 px-2 hover:bg-slate-100"
                    onclick={() => adjustBeds(-1)}>−</button
                >
                <button
                    data-testid="beds-inc"
                    disabled={!snap.canAddBed}
                    title={snap.canAddBed ? undefined : "Need more nurses to open another bed"}
                    class="rounded border px-2 {snap.canAddBed
                        ? 'border-slate-300 hover:bg-slate-100'
                        : 'cursor-not-allowed border-slate-200 text-slate-300'}"
                    onclick={() => adjustBeds(1)}>+</button
                >
            </div>
        </div>

        <!-- Doctors -->
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                <Stethoscope class="h-4 w-4" /> Doctors
            </h2>
            <p data-testid="doctors" class="mt-1 text-2xl font-bold">
                {snap.state.doctors}
            </p>
            <p class="text-xs text-slate-400">
                {snap.bottleneck.freeDoctors} free
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

        <!-- Nurses -->
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                <UserRound class="h-4 w-4" /> Nurses
            </h2>
            <p data-testid="nurses" class="mt-1 text-2xl font-bold">
                {snap.state.nurses}
            </p>
            <p class="text-xs text-slate-400">
                {nurseSplit.ward} ward · {nurseSplit.procedures} procs · {nurseSplit.free} free
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

        <!-- Score / budget -->
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-medium text-slate-500">Budget</h2>
            <p class="mt-1 text-xl font-bold text-emerald-600">
                <span data-testid="patients-treated">{snap.score.patientsTreated}</span> treated
            </p>
            <p class="text-xs text-slate-400">
                <span data-testid="score-total">{snap.score.totalScore}</span> pts ·
                <span data-testid="remaining">£{snap.score.remaining.toLocaleString()}</span> left
            </p>
            <p class="mt-1 text-xs text-slate-400">
                {throughputDisplay} discharges/day ·
                <span data-testid="cancelled">{snap.state.counters.cancelled}</span> cancelled
            </p>
        </div>
    </section>

    <!-- Beds + Waiting list -->
    <section class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- Inpatients -->
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="mb-3 text-sm font-medium text-slate-500">
                Ward beds ({snap.state.beds.occupied}/{snap.state.beds.capacity} occupied)
            </h2>
            <div class="space-y-2">
                {#each inpatients as patient (patient.id)}
                    <InpatientCard
                        {patient}
                        simTime={snap.state.simTime}
                        procedureName={getProcedure(patient.procedureId).displayName}
                    />
                {/each}
                {#each Array.from({ length: freeBeds }) as _, i (i)}
                    <div class="rounded border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-300">
                        Free bed
                    </div>
                {/each}
                {#if snap.state.beds.capacity === 0}
                    <p class="text-sm text-slate-400">No beds configured.</p>
                {/if}
            </div>
        </div>

        <!-- Waiting list -->
        <div class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="mb-3 flex items-center justify-between text-sm font-medium text-slate-500">
                <span>
                    Waiting list
                    (<span data-testid="waiting-count">{snap.state.waitingListLength}</span>)
                </span>
                {#if snap.state.waitingListLength > waitingPatients.slice(0, 10).length}
                    <span class="text-xs text-amber-600">
                        +{snap.state.waitingListLength - 10} more
                    </span>
                {/if}
            </h2>
            <div class="space-y-1.5">
                {#each waitingPatients.slice(0, 10) as patient (patient.id)}
                    <WaitingPatientRow
                        {patient}
                        simTime={snap.state.simTime}
                        procedureName={getProcedure(patient.procedureId).displayName}
                    />
                {/each}
                {#if snap.state.waitingListLength === 0}
                    <p class="text-sm text-slate-400">No patients waiting.</p>
                {/if}
            </div>
        </div>
    </section>
</main>
