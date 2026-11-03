import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
    planClosePullRequestSync,
    shouldHandleClosedUnmergedPr,
} from "./close-sync.ts";
import {
    type BoardColumnRow,
    type CandidateTask,
    matchTask,
} from "./match-task.ts";
import { planMergePullRequestSync } from "./merge-sync.ts";
import {
    planReopenPullRequestSync,
    shouldHandleReopenedPr,
} from "./reopen-sync.ts";

export type SyncResult =
    | { ok: true; reason: string; skipped: true }
    | { ok: true; skipped: false; status: string; taskId: string };

/** `pr_state`-only transition (close / reopen) — never moves the Task column. */
type PrStateOnlySync = {
    plan: (
        matched: CandidateTask | null,
        input: { prHtmlUrl: null | string; prNumber: number }
    ) =>
        | { reason: string; skip: true }
        | {
              skip: false;
              taskId: string;
              update: {
                  pr_number: number;
                  pr_state: "closed" | "open";
                  pr_url: null | string;
              };
          };
    /** Skip reason when the payload is not this transition. */
    skipReason: string;
    syncedReason: string;
};

type PullRequestPayload = {
    action?: string;
    pull_request?: {
        base?: { ref?: string };
        head?: { ref?: string };
        html_url?: string;
        merged?: boolean;
        number?: number;
        state?: string;
    };
    repository?: {
        full_name?: string;
        id?: number;
    };
};

const CLOSED_SYNC: PrStateOnlySync = {
    plan: planClosePullRequestSync,
    skipReason: "not_closed_unmerged_pr",
    syncedReason: "closed_pr_synced",
};

const REOPENED_SYNC: PrStateOnlySync = {
    plan: planReopenPullRequestSync,
    skipReason: "not_reopened_pr",
    syncedReason: "reopened_pr_synced",
};

/** Closed without merge — update `pr_state` only (no column move). */
export async function syncClosedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: (fields: Record<string, unknown>) => void
): Promise<SyncResult> {
    if (!shouldHandleClosedUnmergedPr(payload)) {
        return { ok: true, reason: CLOSED_SYNC.skipReason, skipped: true };
    }

    return syncPrStateOnly(supabase, payload, log, CLOSED_SYNC);
}

export async function syncMergedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: (fields: Record<string, unknown>) => void
): Promise<SyncResult> {
    const pr = payload.pull_request;
    const repoFullName = payload.repository?.full_name;
    const prNumber = pr?.number;
    const headReference = pr?.head?.ref;
    const baseReference = pr?.base?.ref;

    if (
        payload.action !== "closed" ||
        pr?.merged !== true ||
        typeof prNumber !== "number" ||
        !headReference ||
        !baseReference ||
        !repoFullName
    ) {
        return { ok: true, reason: "not_merged_pr", skipped: true };
    }

    const { data: projects, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("github_full_name", repoFullName);

    if (projectError) {
        throw projectError;
    }

    if (!projects?.length) {
        log({ reason: "no_project", repo: repoFullName });
        return { ok: true, reason: "no_project", skipped: true };
    }

    for (const project of projects) {
        const result = await syncInProject(supabase, {
            baseRef: baseReference,
            headRef: headReference,
            log,
            prHtmlUrl: pr.html_url ?? null,
            prNumber,
            projectId: project.id,
            repoFullName,
        });
        if (!result.skipped) {
            return result;
        }
        if (result.reason !== "no_task") {
            return result;
        }
    }

    log({ pr: prNumber, reason: "no_task", repo: repoFullName });
    return { ok: true, reason: "no_task", skipped: true };
}

/** Reopened — update `pr_state` back to `open` only (no column move). */
export async function syncReopenedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: (fields: Record<string, unknown>) => void
): Promise<SyncResult> {
    if (!shouldHandleReopenedPr(payload)) {
        return { ok: true, reason: REOPENED_SYNC.skipReason, skipped: true };
    }

    return syncPrStateOnly(supabase, payload, log, REOPENED_SYNC);
}

async function syncInProject(
    supabase: SupabaseClient,
    input: {
        baseRef: string;
        headRef: string;
        log: (fields: Record<string, unknown>) => void;
        prHtmlUrl: null | string;
        prNumber: number;
        projectId: string;
        repoFullName: string;
    }
): Promise<SyncResult> {
    const { data: taskRows, error: tasksError } = await supabase
        .from("tasks")
        .select(
            "id, board_id, status, branch_name, pr_number, pr_state, task_key, archived_at, parent_id"
        )
        .eq("project_id", input.projectId);

    if (tasksError) {
        throw tasksError;
    }

    const matched = matchTask((taskRows ?? []) as CandidateTask[], {
        headRef: input.headRef,
        prNumber: input.prNumber,
    });

    if (!matched) {
        return { ok: true, reason: "no_task", skipped: true };
    }

    const { data: board, error: boardError } = await supabase
        .from("boards")
        .select("id, base_branch, merge_target_mode, merge_target_column_id")
        .eq("id", matched.board_id)
        .maybeSingle();

    if (boardError) {
        throw boardError;
    }

    if (!board) {
        input.log({ reason: "no_board", taskId: matched.id });
        return { ok: true, reason: "no_board", skipped: true };
    }

    if (board.base_branch !== input.baseRef) {
        input.log({
            base: input.baseRef,
            boardBase: board.base_branch,
            reason: "wrong_base",
            taskId: matched.id,
        });
        return { ok: true, reason: "wrong_base", skipped: true };
    }

    const { data: columns, error: columnsError } = await supabase
        .from("board_columns")
        .select("id, position, is_done, name")
        .eq("board_id", matched.board_id);

    if (columnsError) {
        throw columnsError;
    }

    const columnRows = (columns ?? []) as (BoardColumnRow & {
        name: string;
    })[];

    const plan = planMergePullRequestSync(matched, {
        board,
        columns: columnRows,
        prHtmlUrl: input.prHtmlUrl,
        prNumber: input.prNumber,
    });

    if (plan.skip) {
        input.log({ reason: plan.reason, taskId: matched.id });
        return { ok: true, reason: plan.reason, skipped: true };
    }

    const previousStatus = matched.status;
    const moveTo = plan.moveTo;
    let nextPosition: number | undefined;

    if (moveTo) {
        const { data: maxPosRows, error: maxPosError } = await supabase
            .from("tasks")
            .select("position")
            .eq("board_id", matched.board_id)
            .eq("status", moveTo)
            .order("position", { ascending: false })
            .limit(1);

        if (maxPosError) {
            throw maxPosError;
        }

        nextPosition = (maxPosRows?.[0]?.position ?? -1) + 1;
    }

    const { error: updateError } = await supabase
        .from("tasks")
        .update({
            ...plan.update,
            ...(moveTo ? { position: nextPosition, status: moveTo } : {}),
        })
        .eq("id", matched.id);

    if (updateError) {
        throw updateError;
    }

    const fromColumn = columnRows.find(
        (column) => column.id === previousStatus
    );
    const toColumn = moveTo
        ? columnRows.find((column) => column.id === moveTo)
        : undefined;
    const statusChange = moveTo
        ? {
              from: {
                  id: previousStatus,
                  name: fromColumn?.name ?? previousStatus,
              },
              to: {
                  id: moveTo,
                  name: toColumn?.name ?? moveTo,
              },
          }
        : undefined;

    // Status history only for a real move; the PR change is always recorded.
    const changes = [
        ...(statusChange ? [{ field: "status", ...statusChange }] : []),
        {
            field: "pr",
            from: matched.pr_number
                ? {
                      number: matched.pr_number,
                      state: matched.pr_state ?? "open",
                  }
                : null,
            to: {
                number: input.prNumber,
                state: "merged",
            },
        },
    ];

    const { error: activityError } = await supabase
        .from("activity_log")
        .insert({
            action: "updated",
            metadata: { changes, source: "github_webhook" },
            project_id: input.projectId,
            task_id: matched.id,
            user_id: null,
        });

    if (activityError) {
        throw activityError;
    }

    if (statusChange) {
        // Best-effort: after status is written, GitHub retries hit
        // isAlreadySynced and would never re-run fan-out — so do not fail the
        // webhook here.
        const { error: notificationError } = await supabase.rpc(
            "create_notifications_for_status_change",
            {
                p_metadata: { ...statusChange, source: "github_webhook" },
                p_project_id: input.projectId,
                p_task_id: matched.id,
            }
        );

        if (notificationError) {
            input.log({
                error: notificationError.message,
                projectId: input.projectId,
                reason: "notification_fan_out_failed",
                taskId: matched.id,
            });
        }
    }

    // Same rule as the app: a Subtask "closes" only when it enters Done.
    if (matched.parent_id && toColumn?.is_done && !fromColumn?.is_done) {
        const { error: subtaskNotificationError } = await supabase.rpc(
            "create_task_notifications",
            {
                p_events: [
                    {
                        kind: "subtask_change",
                        metadata: {
                            action: "closed",
                            source: "github_webhook",
                            subtaskKey: matched.task_key,
                        },
                    },
                ],
                p_project_id: input.projectId,
                p_task_id: matched.parent_id,
            }
        );

        if (subtaskNotificationError) {
            input.log({
                error: subtaskNotificationError.message,
                parentId: matched.parent_id,
                projectId: input.projectId,
                reason: "subtask_change_fan_out_failed",
                taskId: matched.id,
            });
        }
    }

    const status = moveTo ?? previousStatus;

    input.log({
        moved: Boolean(moveTo),
        projectId: input.projectId,
        reason: "synced",
        status,
        taskId: matched.id,
    });

    return {
        ok: true,
        skipped: false,
        status,
        taskId: matched.id,
    };
}

async function syncPrStateOnly(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: (fields: Record<string, unknown>) => void,
    sync: PrStateOnlySync
): Promise<SyncResult> {
    const pr = payload.pull_request;
    const repoFullName = payload.repository?.full_name;
    const prNumber = pr?.number;
    const headReference = pr?.head?.ref;

    if (typeof prNumber !== "number" || !headReference || !repoFullName) {
        return { ok: true, reason: sync.skipReason, skipped: true };
    }

    const { data: projects, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("github_full_name", repoFullName);

    if (projectError) {
        throw projectError;
    }

    if (!projects?.length) {
        log({ reason: "no_project", repo: repoFullName });
        return { ok: true, reason: "no_project", skipped: true };
    }

    for (const project of projects) {
        const result = await syncPrStateOnlyInProject(supabase, {
            headRef: headReference,
            log,
            prHtmlUrl: pr?.html_url ?? null,
            prNumber,
            projectId: project.id,
            sync,
        });
        if (!result.skipped) {
            return result;
        }
        if (result.reason !== "no_task") {
            return result;
        }
    }

    log({ pr: prNumber, reason: "no_task", repo: repoFullName });
    return { ok: true, reason: "no_task", skipped: true };
}

async function syncPrStateOnlyInProject(
    supabase: SupabaseClient,
    input: {
        headRef: string;
        log: (fields: Record<string, unknown>) => void;
        prHtmlUrl: null | string;
        prNumber: number;
        projectId: string;
        sync: PrStateOnlySync;
    }
): Promise<SyncResult> {
    const { data: taskRows, error: tasksError } = await supabase
        .from("tasks")
        .select(
            "id, board_id, status, branch_name, pr_number, pr_state, task_key, archived_at, parent_id"
        )
        .eq("project_id", input.projectId);

    if (tasksError) {
        throw tasksError;
    }

    const matched = matchTask((taskRows ?? []) as CandidateTask[], {
        headRef: input.headRef,
        prNumber: input.prNumber,
    });

    const plan = input.sync.plan(matched, {
        prHtmlUrl: input.prHtmlUrl,
        prNumber: input.prNumber,
    });

    if (plan.skip) {
        input.log({
            reason: plan.reason,
            ...(matched ? { taskId: matched.id } : {}),
        });
        return { ok: true, reason: plan.reason, skipped: true };
    }

    const previousPrNumber = matched?.pr_number ?? null;
    const previousPrState = matched?.pr_state ?? null;
    const previousStatus = matched?.status ?? "";

    const { error: updateError } = await supabase
        .from("tasks")
        .update(plan.update)
        .eq("id", plan.taskId);

    if (updateError) {
        throw updateError;
    }

    const changes = [
        {
            field: "pr",
            from: previousPrNumber
                ? {
                      number: previousPrNumber,
                      state: previousPrState ?? "open",
                  }
                : null,
            to: {
                number: input.prNumber,
                state: plan.update.pr_state,
            },
        },
    ];

    const { error: activityError } = await supabase
        .from("activity_log")
        .insert({
            action: "updated",
            metadata: { changes, source: "github_webhook" },
            project_id: input.projectId,
            task_id: plan.taskId,
            user_id: null,
        });

    if (activityError) {
        throw activityError;
    }

    input.log({
        projectId: input.projectId,
        reason: input.sync.syncedReason,
        taskId: plan.taskId,
    });

    return {
        ok: true,
        skipped: false,
        status: previousStatus,
        taskId: plan.taskId,
    };
}
