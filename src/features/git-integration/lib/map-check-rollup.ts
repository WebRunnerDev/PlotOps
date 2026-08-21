import type {
    GitCheckConclusion,
    GitCheckRollup,
    GitCheckRun,
    GitCheckStatus,
} from "@/features/git-integration/api/github-git-api";

const FAILURE_CONCLUSIONS = new Set<GitCheckConclusion>([
    "action_required",
    "cancelled",
    "failure",
    "timed_out",
]);

const PENDING_STATUSES = new Set<GitCheckStatus>([
    "in_progress",
    "pending",
    "queued",
    "requested",
    "waiting",
]);

/** Aggregate check-run list into a single rollup for the task drawer. */
export function mapCheckRollup(checks: readonly GitCheckRun[]): GitCheckRollup {
    if (checks.length === 0) return "neutral";

    let pending = false;
    for (const check of checks) {
        if (
            check.conclusion != undefined &&
            FAILURE_CONCLUSIONS.has(check.conclusion)
        ) {
            return "failure";
        }
        if (
            PENDING_STATUSES.has(check.status) ||
            check.conclusion == undefined
        ) {
            pending = true;
        }
    }

    return pending ? "pending" : "success";
}
