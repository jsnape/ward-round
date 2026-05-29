<script lang="ts">
    import { Activity } from "@lucide/svelte";
    import { formatSimTime } from "$lib/format";

    const simTime = formatSimTime(0);
</script>

<main
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-900"
>
    <div class="flex items-center gap-3">
        <Activity class="h-8 w-8 text-rose-600" />
        <h1 class="text-3xl font-semibold tracking-tight">Ward Round</h1>
    </div>
    <p class="text-slate-500">Stage 1 skeleton — clock reads {simTime}</p>
</main>
