import type { BoardColumn } from "@/features/boards";
import type { ProjectLabel } from "@/features/labels";
import type { TaskEstimate } from "@/features/tasks/lib/task-estimate";
import type {
    Task,
    TaskLinkKind,
    TaskPriority,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";
import type { Database } from "@/shared/api/database.types";

import {
    countTeamPeople,
    fetchBoardColumnIds,
    shouldAutoAssignToCreator,
} from "@/features/boards";
import { parseTaskEstimate } from "@/features/tasks/lib/task-estimate";
import {
    DEFAULT_TASK_PRIORITY,
    TASK_TITLE_MAX_LENGTH,
} from "@/features/tasks/model/constants";
import { resolveRestoreTaskStatus } from "@/features/tasks/model/resolve-restore-task-status";
import { asJson } from "@/shared/api/database";
import { supabase } from "@/shared/api/supabase";

import {
    type DatabaseTask,
    mapDatabaseTask,
    parentIdsMissingFromRows,
    sortTasksByPosition,
    withResolvedParentKeys,
} from "./board-mappers";

export type BoardTasksCache = {
    taskPositions: Map<string, number>;
    tasks: Task[];
};

export type ProjectBoard = {
    columns: BoardColumn[];
    labels: ProjectLabel[];
    taskPositions: Map<string, number>;
    tasks: Task[];
};

async function fetchProjectTeamPeopleCount(projectId: string): Promise<number> {
    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("team_id")
        .eq("id", projectId)
        .single();
    if (projectError) throw projectError;
    if (!project?.team_id) return 0;

    const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("owner_id")
        .eq("id", project.team_id)
        .single();
    if (teamError) throw teamError;

    const { count, error: membersError } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("team_id", project.team_id);
    if (membersError) throw membersError;

    return countTeamPeople({
        hasOwner: Boolean(team?.owner_id),
        memberCount: count ?? 0,
    });
}

async function mapSelectedTaskRow(row: DatabaseTask): Promise<Task> {
    const [task] = await mapSelectedTaskRows([row]);
    return task;
}

async function mapSelectedTaskRows(rows: DatabaseTask[]): Promise<Task[]> {
    const missing = parentIdsMissingFromRows(rows);
    let extraParents: Array<{ id: string; task_key: string }> = [];
    if (missing.length > 0) {
        const { data, error } = await supabase
            .from("tasks")
            .select("id, task_key")
            .in("id", missing);
        if (error) throw error;
        extraParents = data ?? [];
    }
    return withResolvedParentKeys(rows, extraParents).map((row) =>
        mapDatabaseTask(row)
    );
}

function normalizeTaskTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
        throw new Error("Task title is required");
    }
    if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
        throw new Error(
            `Task title must be at most ${TASK_TITLE_MAX_LENGTH} characters`
        );
    }
    return trimmed;
}

const TASK_SELECT = `
  id,
  project_id,
  board_id,
  sprint_id,
  sprint_position,
  title,
  description,
  status,
  priority,
  estimate,
  deadline,
  branch_name,
  assignee_id,
  author_id,
  archived_at,
  archived_by,
  position,
  pr_number,
  pr_state,
  pr_url,
  linked_commit_sha,
  task_key,
  task_type,
  created_at,
  assignee:profiles!tasks_assignee_id_fkey (
    id,
    username,
    avatar_url,
    first_name,
    last_name
  ),
  author:profiles!tasks_author_id_fkey (
    id,
    username,
    avatar_url,
    first_name,
    last_name
  ),
  archived_by_profile:profiles!tasks_archived_by_fkey (
    id,
    username,
    avatar_url,
    first_name,
    last_name
  ),
  task_labels (
    label_id
  ),
  parent_id,
  outgoing_links:task_links!task_links_source_task_id_fkey (
    id,
    kind,
    target:tasks!task_links_target_task_id_fkey (
      id,
      board_id,
      task_key,
      title,
      archived_at,
      status
    )
  ),
  incoming_links:task_links!task_links_target_task_id_fkey (
    id,
    kind,
    source:tasks!task_links_source_task_id_fkey (
      id,
      board_id,
      task_key,
      title,
      archived_at,
      status
    )
  )
`;

/** Optional create overrides for column / backlog quick-add. */
export type CreateTaskRecordExtras = {
    /** Pass `null` to force Unassigned (skips board auto-assign). */
    assigneeId?: null | string;
    /** Pass `null` for priority None. */
    priority?: null | TaskPriority;
};

export type TaskRecordPatch = {
    assignee_id?: null | string;
    author_id?: null | string;
    board_id?: string;
    branch_name?: null | string;
    deadline?: null | string;
    description?: null | string;
    /** Pass `null` to clear estimate (unestimated). Manager+ only. */
    estimate?: null | TaskEstimate;
    linked_commit_sha?: null | string;
    position?: number;
    pr_number?: null | number;
    pr_state?: null | string;
    pr_url?: null | string;
    priority?: null | TaskPriority;
    status?: TaskStatus;
    task_type?: TaskType;
    title?: string;
};

/** Signal archive; DB trigger sets `archived_at` / `archived_by`. */
export async function archiveTaskRecord(taskId: string) {
    await archiveTaskRecords([taskId]);
}

/**
 * Bulk soft-archive via RPC (migration 20260811120000).
 * Writes activity rows server-side; returns how many tasks transitioned.
 */
export async function archiveTaskRecords(taskIds: string[]) {
    const uniqueIds = [...new Set(taskIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
        return { archivedCount: 0 };
    }

    const { data, error } = await supabase.rpc(
        "archive_tasks" as never,
        { p_task_ids: uniqueIds } as never
    );

    if (error) throw error;
    return { archivedCount: typeof data === "number" ? data : 0 };
}

export async function clearTaskParent(taskId: string) {
    const { error } = await supabase.rpc("clear_task_parent", {
        p_task_id: taskId,
    });
    if (error) throw error;

    const { data, error: fetchError } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", taskId)
        .single();

    if (fetchError) throw fetchError;
    return mapSelectedTaskRow(data as DatabaseTask);
}

export async function createSubtaskRecord(
    parentId: string,
    title: string,
    taskType?: TaskType,
    sprintId?: string
) {
    const { data, error } = await supabase.rpc("create_subtask", {
        p_parent_id: parentId,
        p_sprint_id: sprintId ?? null,
        p_task_type: taskType ?? null,
        p_title: normalizeTaskTitle(title),
    });
    if (error) throw error;

    const { data: row, error: fetchError } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", data)
        .single();

    if (fetchError) throw fetchError;
    return mapSelectedTaskRow(row as DatabaseTask);
}

export async function createTaskLinkRecord(
    sourceTaskId: string,
    targetTaskId: string,
    kind: TaskLinkKind
) {
    const { error } = await supabase.rpc("create_task_link", {
        p_kind: kind,
        p_source_task_id: sourceTaskId,
        p_target_task_id: targetTaskId,
    });
    if (error) throw error;

    const { data: row, error: fetchError } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", sourceTaskId)
        .single();

    if (fetchError) throw fetchError;
    return mapSelectedTaskRow(row as DatabaseTask);
}

export async function createTaskRecord(
    projectId: string,
    boardId: string,
    status: TaskStatus,
    title: string,
    taskType?: TaskType,
    sprintId?: string,
    extras?: CreateTaskRecordExtras
) {
    const { data: boardRow, error: boardError } = await supabase
        .from("boards")
        .select("default_task_type, auto_assign_to_creator")
        .eq("id", boardId)
        .single();

    if (boardError) throw boardError;

    let resolvedType: TaskType = taskType ?? "task";
    if (taskType === undefined) {
        const raw = boardRow?.default_task_type;
        if (raw === "bug" || raw === "feature" || raw === "task") {
            resolvedType = raw;
        }
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    let teamPeopleCount = 0;
    if (
        extras?.assigneeId === undefined &&
        boardRow?.auto_assign_to_creator === true
    ) {
        teamPeopleCount = await fetchProjectTeamPeopleCount(projectId);
    }
    const autoAssigneeId = shouldAutoAssignToCreator({
        autoAssignToCreator: boardRow?.auto_assign_to_creator === true,
        teamPeopleCount,
    })
        ? (user?.id ?? null)
        : null;

    const resolvedAssigneeId =
        extras?.assigneeId === undefined ? autoAssigneeId : extras.assigneeId;
    const resolvedPriority =
        extras?.priority === undefined
            ? DEFAULT_TASK_PRIORITY
            : extras.priority;

    const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", boardId)
        .eq("status", status)
        .is("archived_at", null)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    let sprintPosition: number | undefined;
    if (sprintId) {
        const { data: sprintExisting, error: sprintPosError } = await supabase
            .from("tasks")
            .select("sprint_position")
            .eq("sprint_id", sprintId)
            .is("archived_at", null)
            .order("sprint_position", { ascending: false })
            .limit(1);

        if (sprintPosError) throw sprintPosError;
        sprintPosition = (sprintExisting?.[0]?.sprint_position ?? -1) + 1;
    }

    const { data, error } = await supabase
        .from("tasks")
        // task_key is NOT NULL but filled by trg_set_task_key before insert.
        .insert({
            assignee_id: resolvedAssigneeId,
            author_id: user?.id ?? null,
            board_id: boardId,
            position,
            priority: resolvedPriority,
            project_id: projectId,
            ...(sprintId
                ? { sprint_id: sprintId, sprint_position: sprintPosition }
                : {}),
            status,
            task_type: resolvedType,
            title: normalizeTaskTitle(title),
        } as Database["public"]["Tables"]["tasks"]["Insert"])
        .select(TASK_SELECT)
        .single();

    if (error) throw error;
    return mapSelectedTaskRow(data as DatabaseTask);
}

export async function deleteTaskLinkRecord(linkId: string) {
    const { error } = await supabase.rpc("delete_task_link", {
        p_link_id: linkId,
    });
    if (error) throw error;
}

export async function deleteTaskRecord(taskId: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
}

export async function fetchArchivedTasks(boardId: string): Promise<Task[]> {
    const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("board_id", boardId)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });

    if (error) throw error;
    return mapSelectedTaskRows((data ?? []) as DatabaseTask[]);
}

export async function fetchBoardTasks(
    boardId: string
): Promise<BoardTasksCache> {
    const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("board_id", boardId)
        .is("archived_at", null)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) throw error;

    const taskRows = (data ?? []) as DatabaseTask[];
    const tasks = await mapSelectedTaskRows(taskRows);
    const taskPositions = new Map(
        taskRows.map((row) => [row.id, row.position] as const)
    );

    return {
        taskPositions,
        tasks: sortTasksByPosition(tasks, taskPositions),
    };
}

/** Tasks for a Project (all Boards) — palette search and similar.
 * By default excludes archived; pass `includeArchived` for opt-in archive search.
 */
export async function fetchProjectTasks(
    projectId: string,
    options?: { includeArchived?: boolean }
): Promise<Task[]> {
    let query = supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    if (!options?.includeArchived) {
        query = query.is("archived_at", null);
    }

    const { data, error } = await query;

    if (error) throw error;
    return mapSelectedTaskRows((data ?? []) as DatabaseTask[]);
}

export async function moveTaskToBoard(
    taskId: string,
    targetBoardId: string,
    targetStatus: TaskStatus
) {
    const columnIds = await fetchBoardColumnIds(targetBoardId);
    if (columnIds.length === 0) {
        throw new Error("Target board has no columns");
    }
    if (!columnIds.includes(targetStatus)) {
        throw new Error("Target column is not on the destination board");
    }

    const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", targetBoardId)
        .eq("status", targetStatus)
        .is("archived_at", null)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { error } = await supabase
        .from("tasks")
        .update({
            board_id: targetBoardId,
            position,
            status: targetStatus,
        })
        .eq("id", taskId);

    if (error) throw error;

    return { status: targetStatus };
}

export async function persistTaskMoves(
    boardId: string,
    updates: Array<{ id: string; position: number; status: TaskStatus }>
) {
    if (updates.length === 0) return;

    // RPC from migration 20260731182459 — regenerate types after local DB includes it.
    const { error } = await supabase.rpc(
        "persist_task_moves" as never,
        {
            p_board_id: boardId,
            p_updates: asJson(
                updates.map((item) => ({
                    id: item.id,
                    position: item.position,
                    status: item.status,
                }))
            ),
        } as never
    );

    if (error) throw error;
}

/** Replace Task labels atomically (single DB transaction via RPC). */
export async function replaceTaskLabels(taskId: string, labelIds: string[]) {
    const { error } = await supabase.rpc("replace_task_labels", {
        p_label_ids: labelIds,
        p_task_id: taskId,
    });

    if (error) throw error;
}

/** Restore to board; DB trigger clears archive columns. Re-appends to column. */
export async function restoreTaskRecord(taskId: string, boardId: string) {
    const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("status")
        .eq("id", taskId)
        .single();

    if (taskError) throw taskError;

    const columnIds = await fetchBoardColumnIds(boardId);
    const status = resolveRestoreTaskStatus(
        task.status as TaskStatus,
        columnIds
    );

    const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", boardId)
        .eq("status", status)
        .is("archived_at", null)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { error } = await supabase
        .from("tasks")
        .update({
            archived_at: null,
            position,
            status,
        })
        .eq("id", taskId)
        .not("archived_at", "is", null);

    if (error) throw error;
}

export async function setTaskParent(childId: string, parentId: string) {
    const { error } = await supabase.rpc("set_task_parent", {
        p_child_id: childId,
        p_parent_id: parentId,
    });
    if (error) throw error;

    const { data, error: fetchError } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", childId)
        .single();

    if (fetchError) throw fetchError;
    return mapSelectedTaskRow(data as DatabaseTask);
}

/**
 * Atomic task row patch + optional label replace (single DB transaction via RPC).
 * Pass `labelIds: undefined` to leave labels unchanged; `null` / `[]` clears them.
 */
export async function updateTaskDetails(
    taskId: string,
    patch: TaskRecordPatch,
    labelIds?: null | string[]
) {
    const withTitle =
        patch.title === undefined
            ? patch
            : { ...patch, title: normalizeTaskTitle(patch.title) };
    const nextPatch =
        withTitle.estimate === undefined
            ? withTitle
            : {
                  ...withTitle,
                  estimate: parseTaskEstimate(withTitle.estimate),
              };

    // RPC from migration 20260731182502 — regenerate types after local DB includes it.
    const { error } = await supabase.rpc(
        "update_task_details" as never,
        {
            p_label_ids: labelIds === undefined ? null : (labelIds ?? []),
            p_patch: asJson(nextPatch),
            p_task_id: taskId,
        } as never
    );

    if (error) throw error;
}

/** Row patch only — prefer `updateTaskDetails` when labels may change too. */
export async function updateTaskRecord(taskId: string, patch: TaskRecordPatch) {
    const withTitle =
        patch.title === undefined
            ? patch
            : { ...patch, title: normalizeTaskTitle(patch.title) };
    const nextPatch =
        withTitle.estimate === undefined
            ? withTitle
            : {
                  ...withTitle,
                  estimate: parseTaskEstimate(withTitle.estimate),
              };

    const { error } = await supabase
        .from("tasks")
        .update(nextPatch)
        .eq("id", taskId);
    if (error) throw error;
}
