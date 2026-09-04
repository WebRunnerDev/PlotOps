import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
    planClosePullRequestSync,
    shouldHandleClosedUnmergedPr,
} from "./close-sync.ts";
import {
    type CandidateTask,
    isAlreadySynced,
    matchTask,
    pickLastColumnId,
} from "./match-task.ts";

export type SyncResult =
    | { ok: true; reason: string; skipped: true }
    | { ok: true; skipped: false; status: string; taskId: string };

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

/** Closed without merge — update `pr_state` only (no column move). */
export async function syncClosedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: (fields: Record<string, unknown>) => void
): Promise<SyncResult> {
    if (!shouldHandleClosedUnmergedPr(payload)) {
        return { ok: true, reason: "not_closed_unmerged_pr", skipped: true };
    }

    const pr = payload.pull_request;
    const repoFullName = payload.repository?.full_name;
    const prNumber = pr?.number;
    const headReference = pr?.head?.ref;

    if (typeof prNumber !== "number" || !headReference || !repoFullName) {
        return { ok: true, reason: "not_closed_unmerged_pr", skipped: true };
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
        const result = await syncClosedInProject(supabase, {
            headRef: headReference,
            log,
            prHtmlUrl: pr?.html_url ?? null,
            prNumber,
            projectId: project.id,
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

async function syncClosedInProject(
    supabase: SupabaseClient,
    input: {
        headRef: string;
        log: (fields: Record<string, unknown>) => void;
        prHtmlUrl: null | string;
        prNumber: number;
        projectId: string;
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

    const plan = planClosePullRequestSync(matched, {
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
                state: "closed",
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
        reason: "closed_pr_synced",
        taskId: plan.taskId,
    });

    return {
        ok: true,
        skipped: false,
        status: previousStatus,
        taskId: plan.taskId,
    };
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
        .select("id, base_branch")
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
        .select("id, position")
        .eq("board_id", matched.board_id);

    if (columnsError) {
        throw columnsError;
    }

    const lastColumnId = pickLastColumnId(columns ?? []);
    if (!lastColumnId) {
        input.log({ reason: "no_columns", taskId: matched.id });
        return { ok: true, reason: "no_columns", skipped: true };
    }

    if (isAlreadySynced(matched, lastColumnId)) {
        input.log({ reason: "already_synced", taskId: matched.id });
        return { ok: true, reason: "already_synced", skipped: true };
    }

    const { data: maxPosRows, error: maxPosError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", matched.board_id)
        .eq("status", lastColumnId)
        .order("position", { ascending: false })
        .limit(1);

    if (maxPosError) {
        throw maxPosError;
    }

    const nextPosition = (maxPosRows?.[0]?.position ?? -1) + 1;
    const previousStatus = matched.status;

    const { data: statusColumn } = await supabase
        .from("board_columns")
        .select("id, name")
        .eq("board_id", matched.board_id)
        .eq("id", previousStatus)
        .maybeSingle();

    const { data: lastColumn } = await supabase
        .from("board_columns")
        .select("id, name")
        .eq("board_id", matched.board_id)
        .eq("id", lastColumnId)
        .maybeSingle();

    const { error: updateError } = await supabase
        .from("tasks")
        .update({
            position: nextPosition,
            pr_number: input.prNumber,
            pr_state: "merged",
            pr_url: input.prHtmlUrl,
            status: lastColumnId,
        })
        .eq("id", matched.id);

    if (updateError) {
        throw updateError;
    }

    const changes = [
        {
            field: "status",
            from: {
                id: previousStatus,
                name: statusColumn?.name ?? previousStatus,
            },
            to: {
                id: lastColumnId,
                name: lastColumn?.name ?? lastColumnId,
            },
        },
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

    const statusChangeMetadata = {
        from: {
            id: previousStatus,
            name: statusColumn?.name ?? previousStatus,
        },
        source: "github_webhook",
        to: {
            id: lastColumnId,
            name: lastColumn?.name ?? lastColumnId,
        },
    };

    // Best-effort: after status is written, GitHub retries hit isAlreadySynced
    // and would never re-run fan-out — so do not fail the webhook here.
    const { error: notificationError } = await supabase.rpc(
        "create_notifications_for_status_change",
        {
            p_metadata: statusChangeMetadata,
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

    if (matched.parent_id) {
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

    input.log({
        projectId: input.projectId,
        reason: "synced",
        status: lastColumnId,
        taskId: matched.id,
    });

    return {
        ok: true,
        skipped: false,
        status: lastColumnId,
        taskId: matched.id,
    };
}
