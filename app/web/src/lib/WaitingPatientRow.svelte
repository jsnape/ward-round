<script lang="ts">
    import type { PatientView } from "@ward-round/engine";
    import { formatWaitDays } from "$lib/format";

    interface Props {
        patient: PatientView;
        simTime: number;
        procedureName: string;
    }

    const { patient, simTime, procedureName }: Props = $props();

    const shortId = $derived(patient.id.replace(/^p-/, "P-"));

    const urgencyClass: Record<string, string> = {
        emergency: "bg-red-500 text-white",
        urgent: "bg-amber-500 text-white",
        routine: "bg-slate-300 text-slate-700",
    };

    const waitTime = $derived(formatWaitDays(patient.registeredAt, simTime));
</script>

<div class="flex items-center gap-3 rounded border border-slate-100 bg-white px-3 py-2 text-sm">
    <span class="rounded px-1.5 py-0.5 text-xs font-medium uppercase {urgencyClass[patient.urgency] ?? 'bg-slate-200 text-slate-600'}">
        {patient.urgency}
    </span>
    <span class="font-mono font-medium text-slate-700">{shortId}</span>
    <span class="min-w-0 flex-1 truncate text-slate-500">{procedureName}</span>
    <span class="shrink-0 text-xs text-slate-400">{waitTime}</span>
</div>
