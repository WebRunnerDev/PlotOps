import type { BuildsStats } from "@/features/ci-cd/model/types";

/** Raw `total_count` values GitHub reports for the three run buckets. */
export type BuildsStatsCounts = {
    /** Runs with `status=completed`. */
    completed: number;
    /** Runs with `status=success`. */
    success: number;
    /** Runs in any state. */
    total: number;
};

/**
 * Derive summary counts from GitHub's `total_count` buckets.
 *
 * Mirrors `mapActionsStatus`: every completed run that did not conclude
 * `success` reads as a failure, and everything not yet completed is in flight.
 * Deriving failure/running by subtraction keeps the summary to three cheap
 * `per_page=1` requests instead of one per conclusion value.
 */
export function deriveBuildsStats(counts: BuildsStatsCounts): BuildsStats {
    const total = atLeastZero(counts.total);
    const completed = Math.min(atLeastZero(counts.completed), total);
    const success = Math.min(atLeastZero(counts.success), completed);

    return {
        failure: completed - success,
        running: total - completed,
        success,
        total,
    };
}

function atLeastZero(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
