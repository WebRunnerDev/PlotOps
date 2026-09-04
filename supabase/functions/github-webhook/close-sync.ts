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
 */
export function planClosePullRequestSync(
    matched: CandidateTask | null,
    input: { prHtmlUrl: null | string; prNumber: number }
): ClosePullRequestPlan {
    if (!matched) {
        return { reason: "no_task", skip: true };
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
