import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
    planClosePullRequestSync,
    shouldHandleClosedUnmergedPr,
} from "./close-sync.ts";
import {
    fetchBoardBaseBranch,
    fetchTaskGitLinks,
    findRepositories,
    loadCandidateTasks,
    type RepositoryReference,
    writeBranchLink,
    writeGitLink,
} from "./git-links.ts";
import {
    type BoardColumnRow,
    type CandidateTask,
    type GitLinkBinding,
    matchTasks,
    planGitLinkBinding,
    type TaskMatch,
} from "./match-task.ts";
import {
    type GitLinkPrState,
    isMergeSetComplete,
    planMergeCompletion,
} from "./merge-sync.ts";
import {
    planReopenPullRequestSync,
    shouldHandleOpenedPr,
    shouldHandleReopenedPr,
} from "./reopen-sync.ts";

/** `create` webhook payload (a branch or tag was pushed). */
export type CreateBranchPayload = {
    ref?: string;
    ref_type?: string;
    repository?: { full_name?: string; id?: number };
};

/** `repository` limits the run to one Repository (backfill of one Project). */
export type SyncOptions = { repository?: RepositoryReference };

/**
 * `taskId` / `status` describe the first Task the event changed; `taskIds`
 * lists every one (a PR naming several task keys links to each of them).
 */
export type SyncResult =
    | { ok: true; reason: string; skipped: true }
    | {
          ok: true;
          skipped: false;
          status: string;
          taskId: string;
          taskIds: string[];
      };

type Log = (fields: Record<string, unknown>) => void;

type PrState = "closed" | "merged" | "open";

/** `pr_state` transition planned from the Task match (open / reopen / close). */
type PrStateSync = {
    plan: (
        match: null | TaskMatch,
        input: { headRef: string; prHtmlUrl: null | string; prNumber: number }
    ) =>
        | {
              binding: GitLinkBinding;
              skip: false;
              taskId: string;
              update: PrUpdate;
          }
        | { reason: string; skip: true };
    /** Skip reason when the payload is not this transition. */
    skipReason: string;
    syncedReason: string;
};

type PrUpdate = {
    pr_number: number;
    pr_state: PrState;
    pr_url: null | string;
};

type PullRequestEvent = {
    baseRef: null | string;
    body: null | string;
    headRef: string;
    prHtmlUrl: null | string;
    prNumber: number;
    repoFullName: null | string;
    repoId: number;
    title: null | string;
};

type PullRequestPayload = {
    action?: string;
    pull_request?: {
        base?: { ref?: string };
        body?: null | string;
        head?: { ref?: string };
        html_url?: string;
        merged?: boolean;
        number?: number;
        state?: string;
        title?: string;
    };
    repository?: {
        full_name?: string;
        id?: number;
    };
};

/** What `forEachRepository` needs to resolve and log a delivery. */
type RepositoryEvent = {
    prNumber?: number;
    ref?: string;
    repoFullName: null | string;
    repoId: number;
};

const CLOSED_SYNC: PrStateSync = {
    plan: planClosePullRequestSync,
    skipReason: "not_closed_unmerged_pr",
    syncedReason: "closed_pr_synced",
};

const OPENED_SYNC: PrStateSync = {
    plan: planReopenPullRequestSync,
    skipReason: "not_opened_pr",
    syncedReason: "opened_pr_synced",
};

const REOPENED_SYNC: PrStateSync = {
    plan: planReopenPullRequestSync,
    skipReason: "not_reopened_pr",
    syncedReason: "reopened_pr_synced",
};

type Move = {
    from: { id: string; name: string };
    fromIsDone: boolean;
    position: number;
    to: { id: string; name: string };
    toIsDone: boolean;
};

/**
 * Closed without merge — `pr_state=closed`. The PR leaves the merge set, so
 * the Task moves when its remaining PRs are all merged.
 */
export async function syncClosedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: Log,
    options: SyncOptions = {}
): Promise<SyncResult> {
    if (!shouldHandleClosedUnmergedPr(payload)) {
        return { ok: true, reason: CLOSED_SYNC.skipReason, skipped: true };
    }

    return syncPrState(supabase, payload, log, CLOSED_SYNC, options);
}

/**
 * Branch pushed (`create`, ref_type=branch) — every Task whose key is in the
 * branch name and that has no Git link with this branch gets a new
 * branch-only one (ADR 0036). A PR opened from it later joins that link
 * (`bind`).
 */
export async function syncCreatedBranch(
    supabase: SupabaseClient,
    payload: CreateBranchPayload,
    log: Log,
    options: SyncOptions = {}
): Promise<SyncResult> {
    const branchName = payload.ref?.trim();
    const repoId = payload.repository?.id;

    if (
        payload.ref_type !== "branch" ||
        !branchName ||
        typeof repoId !== "number"
    ) {
        return { ok: true, reason: "not_branch_create", skipped: true };
    }

    const event: RepositoryEvent = {
        ref: branchName,
        repoFullName: payload.repository?.full_name ?? null,
        repoId,
    };

    return forEachRepository(
        supabase,
        event,
        log,
        options,
        async (repository) => {
            const matches = matchTasks(
                await loadCandidateTasks(supabase, repository),
                { headRef: branchName }
            );

            return applyEach(matches, async (match) => {
                const binding = planGitLinkBinding(match, {
                    headRef: branchName,
                });

                if (binding !== "auto_link") {
                    const reason =
                        binding === "linked" ? "already_linked" : binding;
                    log({ reason, taskId: match.task.id });
                    return { ok: true, reason, skipped: true };
                }

                const { task } = match;
                await writeBranchLink(
                    supabase,
                    task.id,
                    repository,
                    branchName
                );

                const { error: activityError } = await supabase
                    .from("activity_log")
                    .insert({
                        action: "updated",
                        metadata: {
                            auto_link: { key: match.key ?? task.task_key },
                            changes: [
                                { field: "branch", from: null, to: branchName },
                            ],
                            source: "github_webhook",
                        },
                        project_id: repository.project_id,
                        task_id: task.id,
                        user_id: null,
                    });

                if (activityError) {
                    throw activityError;
                }

                log({
                    autoLinked: true,
                    branch: branchName,
                    projectId: repository.project_id,
                    reason: "branch_linked",
                    taskId: task.id,
                });

                return {
                    ok: true,
                    skipped: false,
                    status: task.status,
                    taskId: task.id,
                    taskIds: [task.id],
                };
            });
        }
    );
}

/**
 * Merged — `pr_state=merged` when the PR targets the Board's Base branch for
 * this Repository; the Task moves once every PR in its merge set is merged.
 */
export async function syncMergedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: Log,
    options: SyncOptions = {}
): Promise<SyncResult> {
    const event = readPullRequestEvent(payload);

    if (
        payload.action !== "closed" ||
        payload.pull_request?.merged !== true ||
        !event?.baseRef
    ) {
        return { ok: true, reason: "not_merged_pr", skipped: true };
    }

    return forEachRepository(supabase, event, log, options, (repository) =>
        syncMergedInRepository(supabase, event, repository, log)
    );
}

/**
 * Opened — `pr_state=open` only; auto-links every Task whose key is in the
 * head branch, PR title or PR body.
 */
export async function syncOpenedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: Log,
    options: SyncOptions = {}
): Promise<SyncResult> {
    if (!shouldHandleOpenedPr(payload)) {
        return { ok: true, reason: OPENED_SYNC.skipReason, skipped: true };
    }

    return syncPrState(supabase, payload, log, OPENED_SYNC, options);
}

/** Reopened — `pr_state` back to `open` only (no column move). */
export async function syncReopenedPullRequest(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: Log,
    options: SyncOptions = {}
): Promise<SyncResult> {
    if (!shouldHandleReopenedPr(payload)) {
        return { ok: true, reason: REOPENED_SYNC.skipReason, skipped: true };
    }

    return syncPrState(supabase, payload, log, REOPENED_SYNC, options);
}

/**
 * Run `apply` for each match in turn. Skipped when every match skipped (the
 * first skip reason wins); otherwise the first change, listing every Task
 * changed.
 */
async function applyEach(
    matches: TaskMatch[],
    apply: (match: TaskMatch) => Promise<SyncResult>
): Promise<SyncResult> {
    if (matches.length === 0) {
        return { ok: true, reason: "no_task", skipped: true };
    }

    const results: SyncResult[] = [];
    for (const match of matches) {
        results.push(await apply(match));
    }

    const changed = results.flatMap((result) =>
        result.skipped ? [] : [result]
    );
    const [first] = changed;
    if (!first) {
        return results[0]!;
    }

    return { ...first, taskIds: changed.map((result) => result.taskId) };
}

/**
 * Write the PR change (if any) to the Task's Git link and move the Task to
 * its merge target column when this event completes the merge set. One
 * activity row carries both; notifications follow a real move only.
 */
async function applyPrEvent(
    supabase: SupabaseClient,
    input: {
        binding: GitLinkBinding;
        headRef: string;
        log: Log;
        match: TaskMatch;
        prUpdate: null | PrUpdate;
        repository: RepositoryReference;
        syncedReason: string;
    }
): Promise<SyncResult> {
    const { log, match, prUpdate, repository } = input;
    const { task } = match;
    const autoLinked = input.binding === "auto_link";
    const projectId = repository.project_id;

    // Every Git link of the Task (all Repositories) as it stands after this
    // event: the matched link takes the incoming PR state, a new one is added.
    const existingLink = autoLinked ? undefined : match.link;
    const storedLinks = await fetchTaskGitLinks(supabase, task.id);
    const links: GitLinkPrState[] = prUpdate
        ? [
              ...storedLinks.filter((link) => link.id !== existingLink?.id),
              prUpdate,
          ]
        : storedLinks;

    const move = await planMove(supabase, task, links, log);

    if (!prUpdate && !move) {
        const reason = move === null ? "already_synced" : "pending_prs";
        log({ reason, taskId: task.id });
        return { ok: true, reason, skipped: true };
    }

    // Git link first: a retry after a failed move sees this PR merged and
    // the Task still off its target column, so it finishes the move.
    if (prUpdate) {
        await writeGitLink(
            supabase,
            task.id,
            repository,
            prUpdate,
            existingLink
                ? { linkId: existingLink.id }
                : { branchName: input.headRef }
        );
    }

    if (move) {
        const { error: updateError } = await supabase
            .from("tasks")
            .update({ position: move.position, status: move.to.id })
            .eq("id", task.id);

        if (updateError) {
            throw updateError;
        }
    }

    const statusChange = move ? { from: move.from, to: move.to } : undefined;

    // Status history only for a real move; the PR change whenever it happened.
    const changes = [
        ...(statusChange ? [{ field: "status", ...statusChange }] : []),
        ...(prUpdate
            ? [
                  {
                      field: "pr",
                      from: existingLink?.pr_number
                          ? {
                                number: existingLink.pr_number,
                                state: existingLink.pr_state ?? "open",
                            }
                          : null,
                      to: {
                          number: prUpdate.pr_number,
                          state: prUpdate.pr_state,
                      },
                  },
              ]
            : []),
    ];

    const { error: activityError } = await supabase
        .from("activity_log")
        .insert({
            action: "updated",
            metadata: {
                ...(autoLinked && prUpdate
                    ? { auto_link: { key: match.key ?? task.task_key } }
                    : {}),
                changes,
                source: "github_webhook",
            },
            project_id: projectId,
            task_id: task.id,
            user_id: null,
        });

    if (activityError) {
        throw activityError;
    }

    if (move) {
        await fanOutStatusChange(supabase, {
            log,
            move,
            projectId,
            task,
        });
    }

    const status = move?.to.id ?? task.status;

    log({
        ...(autoLinked ? { autoLinked: true } : {}),
        moved: Boolean(move),
        projectId,
        reason: input.syncedReason,
        status,
        taskId: task.id,
    });

    return {
        ok: true,
        skipped: false,
        status,
        taskId: task.id,
        taskIds: [task.id],
    };
}

/**
 * Best-effort fan-out: after status is written, GitHub retries skip as
 * already synced and would never re-run it — so do not fail the webhook here.
 */
async function fanOutStatusChange(
    supabase: SupabaseClient,
    input: { log: Log; move: Move; projectId: string; task: CandidateTask }
): Promise<void> {
    const { log, move, projectId, task } = input;

    const { error: notificationError } = await supabase.rpc(
        "create_notifications_for_status_change",
        {
            p_metadata: {
                from: move.from,
                source: "github_webhook",
                to: move.to,
            },
            p_project_id: projectId,
            p_task_id: task.id,
        }
    );

    if (notificationError) {
        log({
            error: notificationError.message,
            projectId,
            reason: "notification_fan_out_failed",
            taskId: task.id,
        });
    }

    // Same rule as the app: a Subtask "closes" only when it enters Done.
    if (!task.parent_id || !move.toIsDone || move.fromIsDone) {
        return;
    }

    const { error: subtaskNotificationError } = await supabase.rpc(
        "create_task_notifications",
        {
            p_events: [
                {
                    kind: "subtask_change",
                    metadata: {
                        action: "closed",
                        source: "github_webhook",
                        subtaskKey: task.task_key,
                    },
                },
            ],
            p_project_id: projectId,
            p_task_id: task.parent_id,
        }
    );

    if (subtaskNotificationError) {
        log({
            error: subtaskNotificationError.message,
            parentId: task.parent_id,
            projectId,
            reason: "subtask_change_fan_out_failed",
            taskId: task.id,
        });
    }
}

/**
 * Resolve Repository first (ADR 0035): the GitHub repo id maps to at most one
 * Repository per Team; try each until one holds a matching Task.
 */
async function forEachRepository(
    supabase: SupabaseClient,
    event: RepositoryEvent,
    log: Log,
    options: SyncOptions,
    run: (repository: RepositoryReference) => Promise<SyncResult>
): Promise<SyncResult> {
    const repositories = options.repository
        ? [options.repository]
        : await findRepositories(supabase, event.repoId);

    if (repositories.length === 0) {
        log({
            reason: "no_project",
            repo: event.repoFullName,
            repoId: event.repoId,
        });
        return { ok: true, reason: "no_project", skipped: true };
    }

    for (const repository of repositories) {
        const result = await run(repository);
        if (!result.skipped || result.reason !== "no_task") {
            return result;
        }
    }

    log({
        ...(event.prNumber === undefined
            ? { ref: event.ref }
            : { pr: event.prNumber }),
        reason: "no_task",
        repo: event.repoFullName,
    });
    return { ok: true, reason: "no_task", skipped: true };
}

/**
 * `Move` when the merge set is complete and the Task is off its merge target
 * column; `null` when complete but staying put; `undefined` while pending.
 */
async function planMove(
    supabase: SupabaseClient,
    task: CandidateTask,
    links: GitLinkPrState[],
    log: Log
): Promise<Move | null | undefined> {
    // Cheap check first: board and columns are read only for a complete set.
    if (!isMergeSetComplete(links)) {
        return undefined;
    }

    const { data: board, error: boardError } = await supabase
        .from("boards")
        .select("id, merge_target_mode, merge_target_column_id")
        .eq("id", task.board_id)
        .maybeSingle();

    if (boardError) {
        throw boardError;
    }

    if (!board) {
        log({ reason: "no_board", taskId: task.id });
        return null;
    }

    const { data: columns, error: columnsError } = await supabase
        .from("board_columns")
        .select("id, position, is_done, name")
        .eq("board_id", task.board_id);

    if (columnsError) {
        throw columnsError;
    }

    const columnRows = (columns ?? []) as (BoardColumnRow & { name: string })[];
    const plan = planMergeCompletion({
        board,
        columns: columnRows,
        links,
        status: task.status,
    });

    if (plan.kind !== "complete" || !plan.moveTo) {
        return null;
    }

    const { data: maxPosRows, error: maxPosError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", task.board_id)
        .eq("status", plan.moveTo)
        .order("position", { ascending: false })
        .limit(1);

    if (maxPosError) {
        throw maxPosError;
    }

    const fromColumn = columnRows.find((column) => column.id === task.status);
    const toColumn = columnRows.find((column) => column.id === plan.moveTo);

    return {
        from: { id: task.status, name: fromColumn?.name ?? task.status },
        fromIsDone: Boolean(fromColumn?.is_done),
        position: (maxPosRows?.[0]?.position ?? -1) + 1,
        to: { id: plan.moveTo, name: toColumn?.name ?? plan.moveTo },
        toIsDone: Boolean(toColumn?.is_done),
    };
}

function readPullRequestEvent(
    payload: PullRequestPayload
): null | PullRequestEvent {
    const pr = payload.pull_request;
    const repoId = payload.repository?.id;
    const prNumber = pr?.number;
    const headReference = pr?.head?.ref;

    if (
        typeof prNumber !== "number" ||
        !headReference ||
        typeof repoId !== "number"
    ) {
        return null;
    }

    return {
        baseRef: pr?.base?.ref ?? null,
        body: pr?.body ?? null,
        headRef: headReference,
        prHtmlUrl: pr?.html_url ?? null,
        prNumber,
        repoFullName: payload.repository?.full_name ?? null,
        repoId,
        title: pr?.title ?? null,
    };
}

async function syncMergedInRepository(
    supabase: SupabaseClient,
    event: PullRequestEvent,
    repository: RepositoryReference,
    log: Log
): Promise<SyncResult> {
    const matches = matchTasks(
        await loadCandidateTasks(supabase, repository),
        event
    );

    return applyEach(matches, async (match) => {
        const binding = planGitLinkBinding(match, event);
        if (binding === "dismissed") {
            log({ reason: "dismissed", taskId: match.task.id });
            return { ok: true, reason: "dismissed", skipped: true };
        }

        const { task } = match;
        const boardBase = await fetchBoardBaseBranch(
            supabase,
            task.board_id,
            repository.id
        );

        // A merge elsewhere leaves the PR open here, so the merge set stays pending.
        if (boardBase !== event.baseRef) {
            log({
                base: event.baseRef,
                boardBase,
                reason: "wrong_base",
                taskId: task.id,
            });
            return { ok: true, reason: "wrong_base", skipped: true };
        }

        return applyPrEvent(supabase, {
            binding,
            headRef: event.headRef,
            log,
            match,
            prUpdate:
                binding === "linked" && match.link?.pr_state === "merged"
                    ? null
                    : {
                          pr_number: event.prNumber,
                          pr_state: "merged",
                          pr_url: event.prHtmlUrl,
                      },
            repository,
            syncedReason: "synced",
        });
    });
}

async function syncPrState(
    supabase: SupabaseClient,
    payload: PullRequestPayload,
    log: Log,
    sync: PrStateSync,
    options: SyncOptions
): Promise<SyncResult> {
    const event = readPullRequestEvent(payload);

    if (!event) {
        return { ok: true, reason: sync.skipReason, skipped: true };
    }

    return forEachRepository(
        supabase,
        event,
        log,
        options,
        async (repository) => {
            const matches = matchTasks(
                await loadCandidateTasks(supabase, repository),
                event
            );

            return applyEach(matches, async (match) => {
                const plan = sync.plan(match, {
                    headRef: event.headRef,
                    prHtmlUrl: event.prHtmlUrl,
                    prNumber: event.prNumber,
                });

                if (plan.skip) {
                    log({ reason: plan.reason, taskId: match.task.id });
                    return { ok: true, reason: plan.reason, skipped: true };
                }

                return applyPrEvent(supabase, {
                    binding: plan.binding,
                    headRef: event.headRef,
                    log,
                    match,
                    prUpdate: plan.update,
                    repository,
                    syncedReason: sync.syncedReason,
                });
            });
        }
    );
}
