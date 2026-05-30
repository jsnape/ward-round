<script lang="ts">
    import type { PatientView } from "@ward-round/engine";
    import { formatProgress } from "$lib/format";

    interface Props {
        patient: PatientView;
        simTime: number;
        procedureName: string;
    }

    const { patient, simTime, procedureName }: Props = $props();

    const shortId = $derived(
        patient.id.replace(/^p-/, "P-"),
    );

    const progress = $derived(
        patient.treatmentStartedAt !== undefined &&
        patient.expectedDischargeAt !== undefined
            ? formatProgress(
                  patient.treatmentStartedAt,
                  patient.expectedDischargeAt,
                  simTime,
              )
            : 0,
    );

    const stateLabel: Record<string, string> = {
        WaitingList: "Waiting",
        Scheduled: "Scheduled",
        Admitted: "Admitted",
        InTreatment: "In treatment",
        ReadyForDischarge: "Ready",
        Discharged: "Discharged",
        Cancelled: "Cancelled",
    };

    const stateBadgeClass: Record<string, string> = {
        WaitingList: "bg-amber-100 text-amber-800",
        Scheduled: "bg-sky-100 text-sky-800",
        Admitted: "bg-blue-100 text-blue-800",
        InTreatment: "bg-violet-100 text-violet-800",
        ReadyForDischarge: "bg-emerald-100 text-emerald-800",
        Discharged: "bg-slate-100 text-slate-600",
        Cancelled: "bg-red-100 text-red-700",
    };

    const outcomeClass: Record<string, string> = {
        good: "bg-emerald-500 text-white",
        complication: "bg-amber-500 text-white",
        poor: "bg-red-600 text-white",
    };
</script>

<div data-testid="inpatient-card" class="rounded border border-slate-200 bg-white p-3 text-sm">
    <div class="flex items-start justify-between gap-2">
        <div>
            <span class="font-mono font-semibold text-slate-800">{shortId}</span>
            <span class="ml-2 text-slate-500">{procedureName}</span>
        </div>
        <div class="flex items-center gap-1">
            {#if patient.outcome}
                <span class="rounded px-1.5 py-0.5 text-xs font-medium {outcomeClass[patient.outcome]}">
                    {patient.outcome}
                </span>
            {/if}
            <span class="rounded px-1.5 py-0.5 text-xs font-medium {stateBadgeClass[patient.state] ?? 'bg-slate-100 text-slate-600'}">
                {stateLabel[patient.state] ?? patient.state}
            </span>
        </div>
    </div>
    {#if patient.state === "InTreatment" && patient.treatmentStartedAt !== undefined}
        <div class="mt-2">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                    class="h-full rounded-full bg-violet-500 transition-all"
                    style="width: {progress}%"
                ></div>
            </div>
            <p class="mt-0.5 text-right text-xs text-slate-400">{progress}%</p>
        </div>
    {/if}
</div>
