<script lang="ts">
    import type { BottleneckAnalysis } from "@ward-round/scoring";

    interface Props {
        bottleneck: BottleneckAnalysis;
    }

    const { bottleneck }: Props = $props();

    const label: Record<string, string> = {
        beds: "Bed shortage",
        doctors: "Doctor shortage",
        nurses: "Nurse shortage",
        balanced: "Balanced",
    };

    const badgeClass: Record<string, string> = {
        beds: "bg-red-100 text-red-700 border-red-200",
        doctors: "bg-amber-100 text-amber-800 border-amber-200",
        nurses: "bg-amber-100 text-amber-800 border-amber-200",
        balanced: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };

    const isUnbalanced = $derived(bottleneck.kind !== "balanced");
</script>

<span
    data-testid="bottleneck-badge"
    class="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium {badgeClass[bottleneck.kind] ?? 'bg-slate-100 text-slate-600 border-slate-200'} {isUnbalanced ? 'animate-pulse' : ''}"
>
    {label[bottleneck.kind] ?? bottleneck.kind}
</span>
