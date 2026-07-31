import type {
    Sprint,
    SprintEvent,
    SprintEventType,
    SprintState,
} from "@/features/sprints/model/types";

import { asJson } from "@/shared/api/database";
import { supabase } from "@/shared/api/supabase";

type DatabaseSprint = {
    board_id: string;
    canceled_at: null | string;
    closed_at: null | string;
    committed_task_ids: null | string[];
    completed_task_ids: null | string[];
    created_at: string;
    ends_on: null | string;
    goal: null | string;
    id: string;
    name: string;
    project_id: string;
    started_at: null | string;
    starts_on: null | string;
    state: string;
};

type DatabaseSprintEvent = {
    actor_id: null | string;
    created_at: string;
    event_type: string;
    id: string;
    payload: null | Record<string, unknown>;
    project_id: string;
    sprint_id: string;
    task_id: null | string;
};

const SPRINT_STATES = new Set<string>([
    "active",
    "canceled",
    "closed",
    "draft",
]);

const SPRINT_EVENT_TYPES = new Set<string>([
    "canceled",
    "closed",
    "started",
    "task_added",
    "task_removed",
]);

export async function assignTasksToSprint(
    updates: Array<{
        sprintId: null | string;
        sprintPosition: null | number;
        taskId: string;
    }>
): Promise<void> {
    if (updates.length === 0) return;

    // RPC from migration 20260731093815 — regenerate types after local DB includes it.
    const { error } = await supabase.rpc(
        "assign_tasks_to_sprint" as never,
        {
            p_updates: asJson(
                updates.map((item) => ({
                    sprintId: item.sprintId,
                    sprintPosition: item.sprintPosition,
                    taskId: item.taskId,
                }))
            ),
        } as never
    );

    if (error) throw error;
}

export async function assignTaskToSprint(
    taskId: string,
    sprintId: null | string,
    sprintPosition: null | number
): Promise<void> {
    const { error } = await supabase
        .from("tasks")
        .update({
            sprint_id: sprintId,
            sprint_position: sprintPosition,
        })
        .eq("id", taskId);

    if (error) throw error;
}

export async function cancelSprint(sprintId: string): Promise<Sprint> {
    const { data, error } = await supabase.rpc("cancel_sprint", {
        p_sprint_id: sprintId,
    });

    if (error) throw error;
    return mapSprint(data as DatabaseSprint);
}

export async function closeSprint(
    sprintId: string,
    completedTaskIds: string[],
    carryoverSprintId: null | string
): Promise<Sprint> {
    const { data, error } = await supabase.rpc("close_sprint", {
        p_carryover_sprint_id: carryoverSprintId ?? undefined,
        p_completed_task_ids: completedTaskIds,
        p_sprint_id: sprintId,
    });

    if (error) throw error;
    return mapSprint(data as DatabaseSprint);
}

export async function createDraftSprint(
    boardId: string,
    projectId: string,
    name: string,
    goal?: string
): Promise<Sprint> {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from("sprints")
        .insert({
            board_id: boardId,
            created_by: user?.id ?? null,
            goal: goal?.trim() || null,
            name: name.trim(),
            project_id: projectId,
            state: "draft",
        })
        .select(
            "id, board_id, project_id, name, goal, state, starts_on, ends_on, committed_task_ids, completed_task_ids, started_at, closed_at, canceled_at, created_at"
        )
        .single();

    if (error) throw error;
    return mapSprint(data as DatabaseSprint);
}

export function defaultSprintEndDate(startIso: string, days = 14): string {
    const [year, month, day] = startIso.split("-").map(Number);
    const start = new Date(year!, month! - 1, day!);
    start.setDate(start.getDate() + (days - 1));
    return todayIsoDate(start);
}

export async function deleteEmptyDraftSprint(sprintId: string): Promise<void> {
    const { error } = await supabase
        .from("sprints")
        .delete()
        .eq("id", sprintId)
        .eq("state", "draft");

    if (error) throw error;
}

/** Permanently removes a closed or canceled sprint (+ cascaded events). */
export async function deletePastSprint(sprintId: string): Promise<void> {
    const { error } = await supabase
        .from("sprints")
        .delete()
        .eq("id", sprintId)
        .in("state", ["closed", "canceled"]);

    if (error) throw error;
}

export async function fetchBoardSprints(boardId: string): Promise<Sprint[]> {
    const { data, error } = await supabase
        .from("sprints")
        .select(
            "id, board_id, project_id, name, goal, state, starts_on, ends_on, committed_task_ids, completed_task_ids, started_at, closed_at, canceled_at, created_at"
        )
        .eq("board_id", boardId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as DatabaseSprint[]).map((row) => mapSprint(row));
}

export async function fetchSprintEvents(
    sprintId: string
): Promise<SprintEvent[]> {
    const { data, error } = await supabase
        .from("sprint_events")
        .select(
            "id, sprint_id, project_id, actor_id, event_type, task_id, payload, created_at"
        )
        .eq("sprint_id", sprintId)
        .order("created_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as DatabaseSprintEvent[]).map((row) =>
        mapSprintEvent(row)
    );
}

export async function reorderSprintMembership(
    updates: Array<{ id: string; sprintPosition: number }>
): Promise<void> {
    if (updates.length === 0) return;

    // RPC from migration 20260731093815 — regenerate types after local DB includes it.
    const { error } = await supabase.rpc(
        "assign_tasks_to_sprint" as never,
        {
            p_updates: asJson(
                updates.map((item) => ({
                    sprintPosition: item.sprintPosition,
                    taskId: item.id,
                }))
            ),
        } as never
    );

    if (error) throw error;
}

export async function startSprint(
    sprintId: string,
    startsOn: string,
    endsOn: string
): Promise<Sprint> {
    const { data, error } = await supabase.rpc("start_sprint", {
        p_ends_on: endsOn,
        p_sprint_id: sprintId,
        p_starts_on: startsOn,
    });

    if (error) throw error;
    return mapSprint(data as DatabaseSprint);
}

/** Local calendar YYYY-MM-DD (not UTC — avoids evening timezone roll-forward). */
export function todayIsoDate(now: Date = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export async function updateDraftSprint(
    sprintId: string,
    patch: { goal?: null | string; name?: string }
): Promise<void> {
    const { error } = await supabase
        .from("sprints")
        .update({
            ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
            ...(patch.goal === undefined
                ? {}
                : { goal: patch.goal?.trim() || null }),
        })
        .eq("id", sprintId)
        .eq("state", "draft");

    if (error) throw error;
}

function mapSprint(row: DatabaseSprint): Sprint {
    const state = SPRINT_STATES.has(row.state)
        ? (row.state as SprintState)
        : "draft";

    return {
        boardId: row.board_id,
        canceledAt: row.canceled_at ?? undefined,
        closedAt: row.closed_at ?? undefined,
        committedTaskIds: row.committed_task_ids ?? [],
        completedTaskIds: row.completed_task_ids ?? [],
        createdAt: row.created_at,
        endsOn: row.ends_on ?? undefined,
        goal: row.goal ?? undefined,
        id: row.id,
        name: row.name,
        projectId: row.project_id,
        startedAt: row.started_at ?? undefined,
        startsOn: row.starts_on ?? undefined,
        state,
    };
}

function mapSprintEvent(row: DatabaseSprintEvent): SprintEvent {
    const eventType = SPRINT_EVENT_TYPES.has(row.event_type)
        ? (row.event_type as SprintEventType)
        : "started";

    return {
        actorId: row.actor_id ?? undefined,
        createdAt: row.created_at,
        eventType,
        id: row.id,
        payload: row.payload ?? {},
        projectId: row.project_id,
        sprintId: row.sprint_id,
        taskId: row.task_id ?? undefined,
    };
}
