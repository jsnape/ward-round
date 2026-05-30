/**
 * Reconstructs historical state by folding the business-event log. Because every
 * outcome is recorded in the log, the past is rebuilt deterministically without
 * re-running the engine or re-rolling any randomness — this is what makes saved
 * history survive an engine upgrade.
 */
import type { OutcomeTier } from "@ward-round/engine";
import type { BusinessEventJson } from "../../generated/businessEvents.js";

export interface ReplaySummary {
    registered: number;
    admitted: number;
    discharged: number;
    cancelled: number;
    outcomes: Record<OutcomeTier, number>;
    budget: { spent: number; remaining: number; outcomeScore: number };
}

export function replayLog(log: readonly BusinessEventJson[]): ReplaySummary {
    const summary: ReplaySummary = {
        registered: 0,
        admitted: 0,
        discharged: 0,
        cancelled: 0,
        outcomes: { good: 0, complication: 0, poor: 0 },
        budget: { spent: 0, remaining: 0, outcomeScore: 0 },
    };
    for (const event of log) {
        switch (event.type) {
            case "PatientRegistered":
                summary.registered += 1;
                break;
            case "PatientAdmitted":
                summary.admitted += 1;
                break;
            case "PatientDischarged":
                summary.discharged += 1;
                summary.outcomes[event.payload.outcome] += 1;
                break;
            case "AdmissionCancelled":
                summary.cancelled += 1;
                break;
            case "BudgetUpdated":
                summary.budget = {
                    spent: event.payload.spent,
                    remaining: event.payload.remaining,
                    outcomeScore: event.payload.outcomeScore,
                };
                break;
            default:
                break;
        }
    }
    return summary;
}
