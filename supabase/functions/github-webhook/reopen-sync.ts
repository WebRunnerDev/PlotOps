import type { CandidateTask } from "./match-task.ts";

export type ReopenedPayload = {
    action?: string;
    pull_request?: {
        number?: number;
    };
};

export type ReopenPullRequestPlan =
    | { reason: string; skip: true }
    | {
          skip: false;
          taskId: string;
          update: {
              pr_number: number;
              pr_state: "open";
              pr_url: null | string;
          };
      };

/**
 * Decide local Task update for a PR reopen.
 * Never changes column/status — merge path owns that.
 * Only updates a task already bound to this PR number (no retarget via
 * branch / task_key fall-through matches).
 */
export function planReopenPullRequestSync(
    matched: CandidateTask | null,
    input: { prHtmlUrl: null | string; prNumber: number }
): ReopenPullRequestPlan {
    if (!matched) {
        return { reason: "no_task", skip: true };
    }

    // Binding integrity: reopen must not rewrite pr_number/url onto a task
    // matched only by branch or task_key when another PR is (or no PR is) linked.
    if (matched.pr_number !== input.prNumber) {
        return { reason: "pr_mismatch", skip: true };
    }

    if (matched.pr_state === "open") {
        return { reason: "already_open", skip: true };
    }

    // GitHub never reopens a merged PR; guard against stale/out-of-order deliveries.
    if (matched.pr_state === "merged") {
        return { reason: "already_merged", skip: true };
    }

    return {
        skip: false,
        taskId: matched.id,
        update: {
            pr_number: input.prNumber,
            pr_state: "open",
            pr_url: input.prHtmlUrl,
        },
    };
}

/** Gate for PR reopen webhook handling. */
export function shouldHandleReopenedPr(payload: ReopenedPayload): boolean {
    return payload.action === "reopened";
}
