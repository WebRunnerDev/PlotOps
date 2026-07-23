import type {
    Sprint,
    SprintEvent,
    SprintEventType,
    SprintState,
} from "@/features/sprints/model/types";

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

    const results = await Promise.all(
        updates.map((item) =>
            supabase
                .from("tasks")
                .update({
                    sprint_id: item.sprintId,
                    sprint_position: item.sprintPosition,
                })
                .eq("id", item.taskId)
        )
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
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
        p_carryover_sprint_id: carryoverSprintId,
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
    const start = new Date(`${startIso}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + (days - 1));
    return start.toISOString().slice(0, 10);
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
    const results = await Promise.all(
        updates.map((item) =>
            supabase
                .from("tasks")
                .update({ sprint_position: item.sprintPosition })
                .eq("id", item.id)
        )
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
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

export function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
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
