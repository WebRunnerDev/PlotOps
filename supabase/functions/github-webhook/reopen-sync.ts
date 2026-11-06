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
 * Never brings back a PR / branch a person unlinked (`dismissed`); a PR no
 * Git link of the Task holds yet gets a new one (auto-link, ADR 0036).
 */
export function planReopenPullRequestSync(
    match: null | TaskMatch,
    input: { headRef: string; prHtmlUrl: null | string; prNumber: number }
): ReopenPullRequestPlan {
    if (!match) {
        return { reason: "no_task", skip: true };
    }

    const binding = planGitLinkBinding(match, input);
    if (binding === "dismissed") {
        return { reason: binding, skip: true };
    }

    // Only a Git link that already holds this PR has a state to compare.
    const currentState =
        binding === "linked" ? (match.link?.pr_state ?? null) : null;

    if (currentState === "open") {
        return { reason: "already_open", skip: true };
    }

    // GitHub never reopens a merged PR; guard against stale/out-of-order deliveries.
    if (currentState === "merged") {
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
