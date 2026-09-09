import type { CandidateTask } from "./match-task.ts";

export type ClosedUnmergedPayload = {
    action?: string;
    pull_request?: {
        merged?: boolean;
        number?: number;
    };
};

export type ClosePullRequestPlan =
    | { reason: string; skip: true }
    | {
          skip: false;
          taskId: string;
          update: {
              pr_number: number;
              pr_state: "closed";
              pr_url: null | string;
          };
      };

/**
 * Decide local Task update for a non-merge PR close.
 * Never changes column/status — merge path owns that.
 * Only updates a task already bound to this PR number (no retarget via
 * branch / task_key fall-through matches).
 */
export function planClosePullRequestSync(
    matched: CandidateTask | null,
    input: { prHtmlUrl: null | string; prNumber: number }
): ClosePullRequestPlan {
    if (!matched) {
        return { reason: "no_task", skip: true };
    }

    // Binding integrity: close must not rewrite pr_number/url onto a task
    // matched only by branch or task_key when another PR is (or no PR is) linked.
    if (matched.pr_number !== input.prNumber) {
        return { reason: "pr_mismatch", skip: true };
    }

    if (matched.pr_state === "closed") {
        return { reason: "already_closed", skip: true };
    }

    if (matched.pr_state === "merged") {
        return { reason: "already_merged", skip: true };
    }

    return {
        skip: false,
        taskId: matched.id,
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
