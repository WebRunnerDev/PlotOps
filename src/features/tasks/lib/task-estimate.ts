import { z } from "zod";

/** Fibonacci story-point scale (null / absent = unestimated). */
export const TASK_ESTIMATE_VALUES = [1, 2, 3, 5, 8, 13, 21] as const;

export type TaskEstimate = (typeof TASK_ESTIMATE_VALUES)[number];

const taskEstimateSchema = z.union([
    z.null(),
    z
        .number()
        .int()
        .refine(
            (value): value is TaskEstimate =>
                (TASK_ESTIMATE_VALUES as readonly number[]).includes(value),
            { message: "Estimate must be a Fibonacci story point" }
        ),
]);

export function isTaskEstimate(value: unknown): value is TaskEstimate {
    return (
        typeof value === "number" &&
        (TASK_ESTIMATE_VALUES as readonly number[]).includes(value)
    );
}

/** Parse a patch/API value; throws when outside Fibonacci | null. */
export function parseTaskEstimate(value: unknown): null | TaskEstimate {
    return taskEstimateSchema.parse(value);
}
