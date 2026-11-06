import {
    type GitLinkBinding,
    planGitLinkBinding,
    type TaskMatch,
} from "./match-task.ts";

export type ClosedUnmergedPayload = {
    action?: string;
    pull_request?: {
        merged?: boolean;
        number?: number;
    };
};

export type ClosePullRequestPlan =
    | {
          binding: GitLinkBinding;
          skip: false;
          taskId: string;
          update: {
              pr_number: number;
              pr_state: "closed";
              pr_url: null | string;
          };
      }
    | { reason: string; skip: true };

/**
 * Decide the Git link update for a non-merge PR close. The column only moves
 * when the close completes the merge set (handled by the caller).
 * Never overwrites a Git link holding another PR or branch (`link_conflict`)
 * nor brings back a PR / branch a person unlinked (`dismissed`); a Task
 * matched only by task key without a link gets one (auto-link).
 */
export function planClosePullRequestSync(
    match: null | TaskMatch,
    input: { headRef: string; prHtmlUrl: null | string; prNumber: number }
): ClosePullRequestPlan {
    if (!match) {
        return { reason: "no_task", skip: true };
    }

    const binding = planGitLinkBinding(match, input);
    if (binding === "link_conflict" || binding === "dismissed") {
        return { reason: binding, skip: true };
    }

    if (match.task.pr_state === "closed") {
        return { reason: "already_closed", skip: true };
    }

    if (match.task.pr_state === "merged") {
        return { reason: "already_merged", skip: true };
    }

    return {
        binding,
        skip: false,
        taskId: match.task.id,
        update: {
            pr_number: input.prNumber,
            pr_state: "closed",
            pr_url: input.prHtmlUrl,
        },
    };
}

/** Gate for non-merge PR close webhook handling. */
export function shouldHandleClosedUnmergedPr(
    payload: ClosedUnmergedPayload
): boolean {
    return (
        payload.action === "closed" && payload.pull_request?.merged === false
    );
}
