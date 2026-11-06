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
 * Never brings back a PR / branch a person unlinked (`dismissed`); a PR no
 * Git link of the Task holds yet gets a new one (auto-link, ADR 0036).
 */
export function planClosePullRequestSync(
    match: null | TaskMatch,
    input: { headRef: string; prHtmlUrl: null | string; prNumber: number }
): ClosePullRequestPlan {
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

    if (currentState === "closed") {
        return { reason: "already_closed", skip: true };
    }

    if (currentState === "merged") {
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
