import { describe, expect, it } from "vitest";

import {
    parseTaskEstimate,
    TASK_ESTIMATE_VALUES,
} from "@/features/tasks/lib/task-estimate";

describe("task estimate seam — Fibonacci | null", () => {
    it("accepts null as unestimated", () => {
        expect(parseTaskEstimate(null)).toBeNull();
    });

    it("accepts every Fibonacci story-point value", () => {
        for (const value of TASK_ESTIMATE_VALUES) {
            expect(parseTaskEstimate(value)).toBe(value);
        }
    });

    it("rejects non-Fibonacci integers and non-integers", () => {
        expect(() => parseTaskEstimate(0)).toThrow();
        expect(() => parseTaskEstimate(4)).toThrow();
        expect(() => parseTaskEstimate(1.5)).toThrow();
        expect(() => parseTaskEstimate("5")).toThrow();
        expect(() => parseTaskEstimate()).toThrow();
    });
});
