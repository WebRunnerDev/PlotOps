import {
    type GitLinkBinding,
    planGitLinkBinding,
    type TaskMatch,
} from "./match-task.ts";

export type ReopenedPayload = {
    action?: string;
    pull_request?: {
        number?: number;
    };
};

export type ReopenPullRequestPlan =
    | {
          binding: GitLinkBinding;
          skip: false;
          taskId: string;
          update: {
              pr_number: number;
              pr_state: "open";
              pr_url: null | string;
          };
      }
    | { reason: string; skip: true };

/**
 * Decide the Git link update for a PR open or reopen.
 * Never changes column/status — merge path owns that.
 * Never overwrites a Git link holding another PR or branch (`link_conflict`);
 * a Task matched only by `task_key` without a link gets one (auto-link).
 */
export function planReopenPullRequestSync(
    match: null | TaskMatch,
    input: { prHtmlUrl: null | string; prNumber: number }
): ReopenPullRequestPlan {
    if (!match) {
        return { reason: "no_task", skip: true };
    }

    const binding = planGitLinkBinding(match);
    if (binding === "link_conflict") {
        return { reason: "link_conflict", skip: true };
    }

    if (match.task.pr_state === "open") {
        return { reason: "already_open", skip: true };
    }

    // GitHub never reopens a merged PR; guard against stale/out-of-order deliveries.
    if (match.task.pr_state === "merged") {
        return { reason: "already_merged", skip: true };
    }

    return {
        binding,
        skip: false,
        taskId: match.task.id,
        update: {
            pr_number: input.prNumber,
            pr_state: "open",
            pr_url: input.prHtmlUrl,
        },
    };
}

/** Gate for PR open webhook handling (auto-link a fresh PR). */
export function shouldHandleOpenedPr(payload: ReopenedPayload): boolean {
    return payload.action === "opened";
}

/** Gate for PR reopen webhook handling. */
export function shouldHandleReopenedPr(payload: ReopenedPayload): boolean {
    return payload.action === "reopened";
}
