import type { BuildStatus } from "@/features/ci-cd/model/types";

/**
 * Map GitHub Actions run/job `status` + `conclusion` to PlotOps BuildStatus.
 * @see https://docs.github.com/en/rest/actions/workflow-runs
 */
export function mapActionsStatus(
    status: null | string | undefined,
    conclusion?: null | string | undefined
): BuildStatus {
    const normalizedStatus = (status ?? "").toLowerCase();
    const normalizedConclusion = (conclusion ?? "").toLowerCase();

    if (
        normalizedStatus === "queued" ||
        normalizedStatus === "pending" ||
        normalizedStatus === "waiting" ||
        normalizedStatus === "requested"
    ) {
        return "queued";
    }

    if (normalizedStatus === "in_progress") {
        return "running";
    }

    if (normalizedStatus === "completed") {
        if (normalizedConclusion === "success") {
            return "success";
        }
        // cancelled / skipped / timed_out / action_required / failure / null
        if (
            normalizedConclusion === "cancelled" ||
            normalizedConclusion === "skipped" ||
            normalizedConclusion === "neutral"
        ) {
            return "failure";
        }
        return "failure";
    }

    // Unknown / missing → treat as still in flight
    if (!normalizedStatus && !normalizedConclusion) {
        return "queued";
    }

    return "running";
}
