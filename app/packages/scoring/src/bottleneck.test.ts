import { describe, expect, it } from "vitest";
import { type WorldStateReadModel, PatientState } from "@ward-round/engine";
import { analyseBottleneck } from "./bottleneck.js";

const ACUITY = 0.5;

function makeState(
    opts: {
        beds?: number;
        occupied?: number;
        doctors?: number;
        nurses?: number;
        waitingListLength?: number;
        inTreatment?: number;
        stalled?: number;
    } = {},
): WorldStateReadModel {
    const beds = opts.beds ?? 8;
    const occupied = opts.occupied ?? 0;
    const doctors = opts.doctors ?? 3;
    const nurses = opts.nurses ?? 6;
    const waitingListLength = opts.waitingListLength ?? 0;
    const inTreatmentCount = opts.inTreatment ?? 0;
    const stalledCount = opts.stalled ?? 0;

    const patients = [
        ...Array.from({ length: inTreatmentCount }, (_, i) => ({
            id: `t-${i}`,
            state: PatientState.InTreatment,
            urgency: "routine" as const,
            procedureId: "appendectomy" as const,
            registeredAt: 0,
        })),
        ...Array.from({ length: stalledCount }, (_, i) => ({
            id: `s-${i}`,
            state: PatientState.Admitted,
            urgency: "routine" as const,
            procedureId: "appendectomy" as const,
            registeredAt: 0,
        })),
    ];

    return {
        simTime: 0,
        beds: { capacity: beds, occupied, free: beds - occupied },
        doctors,
        nurses,
        waitingListLength,
        inTreatmentCount,
        patients,
        counters: { registered: 0, admitted: 0, discharged: 0, cancelled: 0 },
    };
}

describe("analyseBottleneck", () => {
    it("reports balanced when resources are ample", () => {
        const result = analyseBottleneck(makeState(), ACUITY);
        expect(result.kind).toBe("balanced");
        expect(result.stalledPatients).toBe(0);
    });

    it("reports doctors when stalled patients exist and no free doctors", () => {
        // 3 in treatment exhausts 3 doctors; 1 stalled → doctor shortage
        const result = analyseBottleneck(
            makeState({ doctors: 3, inTreatment: 3, stalled: 1 }),
            ACUITY,
        );
        expect(result.kind).toBe("doctors");
        expect(result.freeDoctors).toBe(0);
        expect(result.stalledPatients).toBe(1);
    });

    it("reports nurses when stalled patients exist and no free nurses (but doctors available)", () => {
        // wardNursesNeeded(8, 0.5)=4; 2 in treatment → 6-4-2=0 free nurses; 1 stalled
        const result = analyseBottleneck(
            makeState({ nurses: 6, inTreatment: 2, stalled: 1, doctors: 5 }),
            ACUITY,
        );
        expect(result.kind).toBe("nurses");
        expect(result.freeNurses).toBe(0);
        expect(result.stalledPatients).toBe(1);
    });

    it("reports beds when utilisation >= 90% and waiting list is non-empty", () => {
        // 9/10 beds occupied = 90%, waiting list present
        const result = analyseBottleneck(
            makeState({ beds: 10, occupied: 9, waitingListLength: 2 }),
            ACUITY,
        );
        expect(result.kind).toBe("beds");
        expect(result.bedUtilisation).toBeCloseTo(0.9);
    });

    it("reports doctors when all doctors are in treatment (no stalled)", () => {
        // 3 doctors all treating; no stalled patients
        const result = analyseBottleneck(
            makeState({ doctors: 3, inTreatment: 3, stalled: 0 }),
            ACUITY,
        );
        expect(result.kind).toBe("doctors");
        expect(result.freeDoctors).toBe(0);
    });

    it("reports nurses when all free nurses are exhausted (no stalled)", () => {
        // wardNursesNeeded(8, 0.5)=4; 2 nurses treating → 6-4-2=0 free nurses, no stalled
        const result = analyseBottleneck(
            makeState({ nurses: 6, inTreatment: 2, stalled: 0, doctors: 5 }),
            ACUITY,
        );
        expect(result.kind).toBe("nurses");
        expect(result.freeNurses).toBe(0);
    });

    it("reports balanced when utilisation is high but waiting list is empty", () => {
        const result = analyseBottleneck(
            makeState({ beds: 10, occupied: 9, waitingListLength: 0 }),
            ACUITY,
        );
        expect(result.kind).toBe("balanced");
    });

    it("computes wardNursesNeeded from bed capacity and acuity", () => {
        const result = analyseBottleneck(makeState({ beds: 8 }), 0.5);
        expect(result.wardNursesNeeded).toBe(4); // ceil(8 * 0.5)
    });

    it("returns bedUtilisation of 0 for zero bed capacity", () => {
        const result = analyseBottleneck(makeState({ beds: 0, occupied: 0 }), ACUITY);
        expect(result.bedUtilisation).toBe(0);
    });
});
