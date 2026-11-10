import type { McpUser } from "./auth.ts";
import type { UserSupabase } from "./supabase.ts";

import {
    clampLimit,
    clampOffset,
    MAX_COMMENT_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_LIST_LIMIT,
    MAX_SEARCH_LENGTH,
    MAX_TITLE_LENGTH,
} from "./limits.ts";

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TASK_TYPES = new Set(["bug", "epic", "story", "task"]);
const PRIORITIES = new Set(["high", "low", "medium", "urgent"]);
const EPIC_COLORS = new Set([
    "blue",
    "gray",
    "green",
    "orange",
    "pink",
    "purple",
    "red",
    "teal",
    "yellow",
]);

const TASK_LIST_SELECT = [
    "id",
    "task_key",
    "title",
    "status",
    "priority",
    "task_type",
    "board_id",
    "project_id",
    "assignee_id",
    "author_id",
    "parent_id",
    "epic_id",
    "deadline",
    "estimate",
    "archived_at",
    "created_at",
].join(", ");

/**
 * Git data lives in `task_git_links` (any number of branches / PRs per Task
 * per Repository, ADR 0036), embedded as `git_links` with the Repository it
 * belongs to.
 */
const TASK_GIT_LINKS_SELECT =
    "git_links:task_git_links(id, repository_id, branch_name, pr_number, pr_state, pr_url, created_at, repository:project_repositories(github_full_name, github_html_url))";

export const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT}, description, epic_color, sprint_id, ${TASK_GIT_LINKS_SELECT}`;

const COMMENT_SELECT =
    "id, task_id, parent_id, body, author_id, created_at, updated_at";

const TASK_REF_SELECT = "id, task_key, title, task_type, status, archived_at";

const LINK_KINDS = new Set(["blocks", "relates_to"]);

/**
 * Task descriptions and comments are edited in a Notion-like TipTap editor
 * that stores HTML. Markdown is shown verbatim (`## Title`, `**bold**`), so
 * agents must send HTML. Shared by tool schemas and server instructions.
 */
export const RICH_TEXT_FORMAT_HINT = [
    "HTML for the Notion-like rich text editor (TipTap) — NOT Markdown; Markdown is rendered as literal text.",
    "Use <p>, <h1>-<h3>, <strong>, <em>, <u>, <s>, <mark>, <code>, <a href>, <blockquote>, <hr>,",
    '<ul>/<ol>/<li>, checklists <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>…</p></li></ul>,',
    '<pre><code class="language-ts">…</code></pre>, <table><tr><th>/<td>.',
    'Mention a member (from list_members): <span data-type="mention" data-id="USER_ID" data-label="Name">@Name</span>.',
    'Reference a task: <span data-type="taskMention" data-id="TASK_ID" data-label="KEY-1">#KEY-1</span>.',
    "Do not encode parent/subtask, epic or blocks/relates links as text — use the parent_id / epic_id fields and link_tasks.",
].join(" ");

const MARKDOWN_LINE_PATTERN = /^(?:#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|>\s|```)/m;
const MARKDOWN_INLINE_PATTERN = /\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\//;

export type ToolContext = {
    clientId: null | string;
    supabase: UserSupabase;
    user: McpUser;
};

export type ToolDefinition = {
    description: string;
    handler: (
        arguments_: Record<string, unknown>,
        context: ToolContext
    ) => Promise<ToolResult>;
    inputSchema: Record<string, unknown>;
    name: string;
    readOnly: boolean;
};

export type ToolResult = {
    isError?: boolean;
    resourceId?: null | string;
    resourceType?: null | string;
    text: string;
};

type TaskLinkRow = {
    id: string;
    kind: string;
    source: null | TaskRef;
    source_task_id: string;
    target: null | TaskRef;
    target_task_id: string;
};

type TaskRef = {
    archived_at: null | string;
    id: string;
    status: string;
    task_key: string;
    task_type: string;
    title: string;
};

type TaskRelationSource = {
    epic_id: null | string;
    id: string;
    parent_id: null | string;
    task_type: string;
};

export class ToolInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ToolInputError";
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

/**
 * Rejects text that is Markdown rather than HTML. Plain prose is fine (the
 * editor wraps lines in paragraphs); HTML input is never inspected.
 */
function assertRichText(value: string, field: string): void {
    if (/<\/?[a-z][\s\S]*>/i.test(value)) return;
    if (
        MARKDOWN_LINE_PATTERN.test(value) ||
        MARKDOWN_INLINE_PATTERN.test(value)
    ) {
        throw new ToolInputError(
            `${field} looks like Markdown. Send ${RICH_TEXT_FORMAT_HINT}`
        );
    }
}

async function createTask(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const boardId = requireUuid(arguments_.board_id, "board_id");
    const title = requireString(arguments_.title, "title");
    if (title.length > MAX_TITLE_LENGTH) {
        throw new ToolInputError(
            `title must be at most ${MAX_TITLE_LENGTH} characters`
        );
    }

    const options: Record<string, unknown> = {};
    const projectId = optionalUuid(arguments_.project_id, "project_id");
    if (projectId) options.project_id = projectId;

    const status = optionalString(arguments_.status)?.trim();
    if (status) options.status = status;

    const taskType = optionalString(arguments_.task_type)?.trim();
    if (taskType) {
        if (!TASK_TYPES.has(taskType)) {
            throw new ToolInputError("task_type is invalid");
        }
        options.task_type = taskType;
    }

    if (arguments_.priority !== undefined) {
        if (arguments_.priority === null) {
            options.priority = null;
        } else {
            const priority = requireString(arguments_.priority, "priority");
            if (!PRIORITIES.has(priority)) {
                throw new ToolInputError("priority is invalid");
            }
            options.priority = priority;
        }
    }

    if (arguments_.assignee_id !== undefined) {
        options.assignee_id =
            arguments_.assignee_id === null
                ? null
                : requireUuid(arguments_.assignee_id, "assignee_id");
    }

    const sprintId = optionalUuid(arguments_.sprint_id, "sprint_id");
    if (sprintId) options.sprint_id = sprintId;

    const epicId = optionalUuid(arguments_.epic_id, "epic_id");
    if (epicId) options.epic_id = epicId;

    const epicColor = optionalString(arguments_.epic_color)?.trim();
    if (epicColor) {
        if (!EPIC_COLORS.has(epicColor)) {
            throw new ToolInputError("epic_color is invalid");
        }
        options.epic_color = epicColor;
    }

    const description = optionalString(arguments_.description);
    if (description != undefined) {
        if (description.length > MAX_DESCRIPTION_LENGTH) {
            throw new ToolInputError("description is too long");
        }
        assertRichText(description, "description");
        options.description = description;
    }

    const parentId = optionalUuid(arguments_.parent_id, "parent_id");
    if (parentId && (epicId || taskType === "epic")) {
        throw new ToolInputError(
            "A Subtask cannot be an Epic or carry epic_id; it belongs to its Parent Task's Epic"
        );
    }

    const id = await rpcResult(
        context.supabase.rpc("create_task", {
            p_board_id: boardId,
            p_options: options,
            p_title: title,
        })
    );
    const resourceId = typeof id === "string" ? id : null;

    let parentError: string | undefined;
    if (parentId) {
        const { error } = await context.supabase.rpc("set_task_parent", {
            p_child_id: id,
            p_parent_id: parentId,
        });
        if (error) parentError = error.message;
    }

    const { data: task, error } = await context.supabase
        .from("tasks")
        .select(TASK_DETAIL_SELECT)
        .eq("id", id)
        .single();
    if (error) throw new Error(error.message);

    if (parentError) {
        return {
            isError: true,
            resourceId,
            resourceType: "task",
            text: jsonText({
                error: `Task was created but not attached to parent_id: ${parentError}`,
                task,
            }),
        };
    }

    return {
        resourceId,
        resourceType: "task",
        text: jsonText({ task }),
    };
}

function escapeIlike(value: string): string {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll("%", String.raw`\%`)
        .replaceAll("_", String.raw`\_`);
}

async function getTask(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const taskId = optionalUuid(arguments_.task_id, "task_id");
    const taskKey = optionalString(arguments_.task_key)?.trim();
    const projectId = optionalUuid(arguments_.project_id, "project_id");

    if (!taskId && !taskKey) {
        throw new ToolInputError("task_id or task_key is required");
    }

    let request = context.supabase.from("tasks").select(TASK_DETAIL_SELECT);
    if (taskId) request = request.eq("id", taskId);
    if (taskKey) request = request.eq("task_key", taskKey);
    if (projectId) request = request.eq("project_id", projectId);

    const { data: rows, error } = await request.limit(2);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
        throw new Error("Task not found");
    }
    if (rows.length > 1) {
        throw new ToolInputError(
            "Multiple tasks match that key; pass project_id or task_id"
        );
    }
    const task = rows[0]!;

    const { data: comments, error: commentsError } = await context.supabase
        .from("task_comments")
        .select(COMMENT_SELECT)
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });
    if (commentsError) throw new Error(commentsError.message);

    const { data: labels, error: labelsError } = await context.supabase
        .from("task_labels")
        .select("label_id, labels(id, name, color)")
        .eq("task_id", task.id);
    if (labelsError) throw new Error(labelsError.message);

    const relations = await loadRelations(
        task as unknown as TaskRelationSource,
        context
    );

    return {
        resourceId: task.id,
        resourceType: "task",
        text: jsonText({
            comments: comments ?? [],
            labels: labels ?? [],
            ...relations,
            task,
        }),
    };
}

function jsonText(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

async function listBoards(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const projectId = requireUuid(arguments_.project_id, "project_id");
    const { data: boards, error: boardsError } = await context.supabase
        .from("boards")
        .select("id, name, position, project_id, is_development")
        .eq("project_id", projectId)
        .order("position");
    if (boardsError) throw new Error(boardsError.message);

    const boardIds = (boards ?? []).map((board: { id: string }) => board.id);
    if (boardIds.length === 0) {
        return { text: jsonText({ boards: [] }) };
    }

    const { data: columns, error: columnsError } = await context.supabase
        .from("board_columns")
        .select("id, name, position, is_done, board_id")
        .in("board_id", boardIds)
        .order("position");
    if (columnsError) throw new Error(columnsError.message);

    const columnsByBoard = new Map<string, unknown[]>();
    for (const column of columns ?? []) {
        const list = columnsByBoard.get(column.board_id) ?? [];
        list.push({
            id: column.id,
            is_done: column.is_done,
            name: column.name,
            position: column.position,
        });
        columnsByBoard.set(column.board_id, list);
    }

    return {
        text: jsonText({
            boards: (boards ?? []).map((board: { id: string }) => ({
                ...board,
                columns: columnsByBoard.get(board.id) ?? [],
            })),
        }),
    };
}

async function listProjects(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const limit = clampLimit(
        typeof arguments_.limit === "number" ? arguments_.limit : undefined
    );
    const { data, error } = await context.supabase
        .from("projects")
        .select("id, name, slug, team_id")
        .order("name")
        .limit(limit);
    if (error) throw new Error(error.message);
    return { text: jsonText({ projects: data ?? [] }) };
}

async function listTasks(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const projectId = optionalUuid(arguments_.project_id, "project_id");
    const boardId = optionalUuid(arguments_.board_id, "board_id");
    const status = optionalString(arguments_.status)?.trim();
    const assignee = optionalString(arguments_.assignee_id)?.trim();
    const query = optionalString(arguments_.q)?.trim();
    const includeArchived = arguments_.include_archived === true;
    const limit = clampLimit(
        typeof arguments_.limit === "number" ? arguments_.limit : undefined
    );
    const offset = clampOffset(
        typeof arguments_.offset === "number" ? arguments_.offset : undefined
    );

    if (!projectId && !boardId) {
        throw new ToolInputError("project_id or board_id is required");
    }
    if (query && query.length > MAX_SEARCH_LENGTH) {
        throw new ToolInputError(
            `q must be at most ${MAX_SEARCH_LENGTH} characters`
        );
    }

    let request = context.supabase
        .from("tasks")
        .select(TASK_LIST_SELECT)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (projectId) request = request.eq("project_id", projectId);
    if (boardId) request = request.eq("board_id", boardId);
    if (status) request = request.eq("status", status);
    if (!includeArchived) request = request.is("archived_at", null);

    const parentId = optionalUuid(arguments_.parent_id, "parent_id");
    if (parentId) request = request.eq("parent_id", parentId);
    const epicId = optionalUuid(arguments_.epic_id, "epic_id");
    if (epicId) request = request.eq("epic_id", epicId);

    if (assignee === "me") {
        request = request.eq("assignee_id", context.user.id);
    } else if (assignee === "unassigned") {
        request = request.is("assignee_id", null);
    } else if (assignee) {
        request = request.eq(
            "assignee_id",
            requireUuid(assignee, "assignee_id")
        );
    }

    if (query) {
        const escaped = escapeIlike(query);
        request = request.or(
            `title.ilike.%${escaped}%,task_key.ilike.%${escaped}%`
        );
    }

    const { data, error } = await request;
    if (error) throw new Error(error.message);
    return { text: jsonText({ tasks: data ?? [] }) };
}

/**
 * Structured relations as the task drawer shows them: Parent Task, Subtasks,
 * Epic (or Epic members when the task is an Epic) and Task Links. A `blocks`
 * link reads "blocks" from the source and "blocked_by" from the target.
 */
async function loadRelations(task: TaskRelationSource, context: ToolContext) {
    const refById = async (id: null | string): Promise<null | TaskRef> => {
        if (!id) return null;
        const { data, error } = await context.supabase
            .from("tasks")
            .select(TASK_REF_SELECT)
            .eq("id", id)
            .limit(1);
        if (error) throw new Error(error.message);
        return ((data ?? [])[0] as TaskRef | undefined) ?? null;
    };

    const childrenBy = async (column: "epic_id" | "parent_id") => {
        const { data, error } = await context.supabase
            .from("tasks")
            .select(TASK_REF_SELECT)
            .eq(column, task.id)
            .order("created_at", { ascending: true })
            .limit(MAX_LIST_LIMIT);
        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as TaskRef[];
    };

    const isEpic = task.task_type === "epic";
    const [parent, epic, subtasks, epicTasks, linkRows] = await Promise.all([
        refById(task.parent_id),
        refById(task.epic_id),
        childrenBy("parent_id"),
        isEpic ? childrenBy("epic_id") : Promise.resolve(),
        context.supabase
            .from("task_links")
            .select(
                `id, kind, source_task_id, target_task_id, source:tasks!task_links_source_task_id_fkey(${TASK_REF_SELECT}), target:tasks!task_links_target_task_id_fkey(${TASK_REF_SELECT})`
            )
            .or(`source_task_id.eq.${task.id},target_task_id.eq.${task.id}`)
            .then(({ data, error }) => {
                if (error) throw new Error(error.message);
                return (data ?? []) as unknown as TaskLinkRow[];
            }),
    ]);

    const links = linkRows.map((link) => {
        const outgoing = link.source_task_id === task.id;
        let relation = "relates_to";
        if (link.kind === "blocks")
            relation = outgoing ? "blocks" : "blocked_by";
        return {
            kind: link.kind,
            link_id: link.id,
            relation,
            task: outgoing ? link.target : link.source,
        };
    });

    return {
        epic,
        ...(epicTasks ? { epic_tasks: epicTasks } : {}),
        links,
        parent,
        subtasks,
    };
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function optionalUuid(value: unknown, field: string): string | undefined {
    if (value == undefined || value === "") return undefined;
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
        throw new ToolInputError(`${field} must be a UUID`);
    }
    return value;
}

function requireString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim() === "") {
        throw new ToolInputError(`${field} is required`);
    }
    return value.trim();
}

function requireUuid(value: unknown, field: string): string {
    const uuid = optionalUuid(value, field);
    if (!uuid) throw new ToolInputError(`${field} is required`);
    return uuid;
}

async function rpcResult<T>(
    promise: PromiseLike<{ data: T; error: null | { message: string } }>
): Promise<T> {
    const { data, error } = await promise;
    if (error) throw new Error(error.message);
    return data;
}

async function whoami(
    _arguments: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    return {
        text: jsonText({
            client_id: context.clientId,
            email: context.user.email ?? null,
            user_id: context.user.id,
        }),
    };
}

const UPDATE_TASK_FIELDS = new Set([
    "assignee_id",
    "deadline",
    "description",
    "epic_color",
    "epic_id",
    "estimate",
    "priority",
    "task_type",
    "title",
]);

type MemberProfile = {
    first_name: null | string;
    id: string;
    last_name: null | string;
    username: null | string;
};

async function addComment(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const taskId = requireUuid(arguments_.task_id, "task_id");
    const body = requireString(arguments_.body, "body");
    if (body.length > MAX_COMMENT_LENGTH) {
        throw new ToolInputError("body is too long");
    }
    assertRichText(body, "body");
    const parentId = optionalUuid(arguments_.parent_id, "parent_id") ?? null;
    const id = await rpcResult(
        context.supabase.rpc("add_task_comment", {
            p_body: body,
            p_parent_id: parentId,
            p_task_id: taskId,
        })
    );
    return {
        resourceId: typeof id === "string" ? id : null,
        resourceType: "comment",
        text: jsonText({
            comment_id: id,
            parent_id: parentId,
            task_id: taskId,
        }),
    };
}

async function changeStatus(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const taskId = requireUuid(arguments_.task_id, "task_id");
    const columnId = requireString(arguments_.column_id, "column_id");
    await rpcResult(
        context.supabase.rpc("change_task_status", {
            p_column_id: columnId,
            p_task_id: taskId,
        })
    );
    return {
        resourceId: taskId,
        resourceType: "task",
        text: jsonText({ column_id: columnId, task_id: taskId }),
    };
}

function displayName(profile: MemberProfile | null | undefined): string {
    if (!profile) return "";
    const composed = [profile.first_name, profile.last_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ");
    return composed || profile.username?.trim() || "";
}

function firstOf<T>(value: null | T | T[] | undefined): null | T {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function linkTasks(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const sourceId = requireUuid(arguments_.source_task_id, "source_task_id");
    const targetId = requireUuid(arguments_.target_task_id, "target_task_id");
    const kind = requireString(arguments_.kind, "kind");
    if (!LINK_KINDS.has(kind)) {
        throw new ToolInputError("kind must be blocks or relates_to");
    }
    if (sourceId === targetId) {
        throw new ToolInputError("A Task cannot link to itself");
    }
    const id = await rpcResult(
        context.supabase.rpc("create_task_link", {
            p_kind: kind,
            p_source_task_id: sourceId,
            p_target_task_id: targetId,
        })
    );
    return {
        resourceId: sourceId,
        resourceType: "task",
        text: jsonText({
            kind,
            link_id: id,
            source_task_id: sourceId,
            target_task_id: targetId,
        }),
    };
}

async function listEpics(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const projectId = requireUuid(arguments_.project_id, "project_id");
    const includeArchived = arguments_.include_archived === true;
    const rows = await rpcResult(
        context.supabase.rpc("project_epics", { p_project_id: projectId })
    );
    const epics = ((rows ?? []) as { archived_at: null | string }[]).filter(
        (epic) => includeArchived || epic.archived_at === null
    );
    return { text: jsonText({ epics }) };
}

/** Team Owner + Team Members of the Project's Team — the assignee picker set. */
async function listMembers(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const projectId = requireUuid(arguments_.project_id, "project_id");

    const { data: projects, error: projectError } = await context.supabase
        .from("projects")
        .select("id, team_id, team:teams!projects_team_id_fkey(owner_id)")
        .eq("id", projectId)
        .limit(1);
    if (projectError) throw new Error(projectError.message);
    const project = (projects ?? [])[0] as
        | undefined
        | {
              team: null | { owner_id: string } | { owner_id: string }[];
              team_id: string;
          };
    if (!project) throw new Error("Project not found");
    const ownerId = firstOf(project.team)?.owner_id ?? null;

    const { data: memberRows, error: membersError } = await context.supabase
        .from("team_members")
        .select(
            "user_id, role, profile:profiles!team_members_user_id_fkey(id, username, first_name, last_name)"
        )
        .eq("team_id", project.team_id)
        .order("created_at", { ascending: true });
    if (membersError) throw new Error(membersError.message);

    type Member = {
        is_owner: boolean;
        name: string;
        role: null | string;
        user_id: string;
        username: null | string;
    };
    const byId = new Map<string, Member>();

    if (ownerId) {
        const { data: owners, error: ownerError } = await context.supabase
            .from("profiles")
            .select("id, username, first_name, last_name")
            .eq("id", ownerId)
            .limit(1);
        if (ownerError) throw new Error(ownerError.message);
        const owner = (owners ?? [])[0] as MemberProfile | undefined;
        byId.set(ownerId, {
            is_owner: true,
            name: displayName(owner),
            role: "owner",
            user_id: ownerId,
            username: owner?.username ?? null,
        });
    }

    for (const row of (memberRows ?? []) as unknown as {
        profile: MemberProfile | MemberProfile[] | null;
        role: string;
        user_id: string;
    }[]) {
        if (byId.has(row.user_id)) continue;
        const profile = firstOf(row.profile);
        byId.set(row.user_id, {
            is_owner: false,
            name: displayName(profile),
            role: row.role,
            user_id: row.user_id,
            username: profile?.username ?? null,
        });
    }

    return {
        text: jsonText({
            members: [...byId.values()].toSorted((left, right) =>
                left.name.localeCompare(right.name)
            ),
        }),
    };
}

/** Detaches from the current parent first: set_task_parent refuses a re-parent. */
async function setParent(
    taskId: string,
    parentId: null | string,
    context: ToolContext
): Promise<void> {
    const { data, error } = await context.supabase
        .from("tasks")
        .select("id, parent_id")
        .eq("id", taskId)
        .limit(1);
    if (error) throw new Error(error.message);
    const current = (data ?? [])[0] as
        undefined | { id: string; parent_id: null | string };
    if (!current) throw new Error("Task not found");
    if (current.parent_id === parentId) return;

    if (current.parent_id) {
        await rpcResult(
            context.supabase.rpc("clear_task_parent", { p_task_id: taskId })
        );
    }
    if (parentId) {
        await rpcResult(
            context.supabase.rpc("set_task_parent", {
                p_child_id: taskId,
                p_parent_id: parentId,
            })
        );
    }
}

async function unlinkTasks(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const linkId = requireUuid(arguments_.link_id, "link_id");
    await rpcResult(
        context.supabase.rpc("delete_task_link", { p_link_id: linkId })
    );
    return {
        resourceId: linkId,
        resourceType: "task_link",
        text: jsonText({ deleted: true, link_id: linkId }),
    };
}

async function updateTask(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const taskId = requireUuid(arguments_.task_id, "task_id");
    const patch: Record<string, unknown> = {};

    for (const field of UPDATE_TASK_FIELDS) {
        if (!(field in arguments_)) continue;
        const value = arguments_[field];
        if (field === "title") {
            const title = requireString(value, "title");
            if (title.length > MAX_TITLE_LENGTH) {
                throw new ToolInputError("title is too long");
            }
            patch.title = title;
            continue;
        }
        if (field === "description") {
            if (value != undefined && typeof value !== "string") {
                throw new ToolInputError("description must be a string");
            }
            if (
                typeof value === "string" &&
                value.length > MAX_DESCRIPTION_LENGTH
            ) {
                throw new ToolInputError("description is too long");
            }
            if (typeof value === "string") assertRichText(value, "description");
            patch.description = value ?? null;
            continue;
        }
        if (field === "priority") {
            if (value === null || value === "") {
                patch.priority = null;
            } else {
                const priority = requireString(value, "priority");
                if (!PRIORITIES.has(priority)) {
                    throw new ToolInputError("priority is invalid");
                }
                patch.priority = priority;
            }
            continue;
        }
        if (field === "task_type") {
            const taskType = requireString(value, "task_type");
            if (!TASK_TYPES.has(taskType)) {
                throw new ToolInputError("task_type is invalid");
            }
            patch.task_type = taskType;
            continue;
        }
        if (field === "assignee_id" || field === "epic_id") {
            patch[field] = value === null ? null : requireUuid(value, field);
            continue;
        }
        if (field === "epic_color") {
            if (value === null || value === "") {
                patch.epic_color = null;
            } else {
                const color = requireString(value, "epic_color");
                if (!EPIC_COLORS.has(color)) {
                    throw new ToolInputError("epic_color is invalid");
                }
                patch.epic_color = color;
            }
            continue;
        }
        if (field === "deadline") {
            patch.deadline =
                value === null ? null : requireString(value, "deadline");
            continue;
        }
        if (field === "estimate") {
            if (value === null) {
                patch.estimate = null;
            } else if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new ToolInputError("estimate must be a number");
            } else {
                patch.estimate = value;
            }
        }
    }

    const labelIds = arguments_.label_ids;
    let nextLabels: string[] | undefined;
    if (labelIds !== undefined) {
        if (!Array.isArray(labelIds)) {
            throw new ToolInputError("label_ids must be an array of UUIDs");
        }
        nextLabels = labelIds.map((id) => requireUuid(id, "label_ids[]"));
    }

    let nextParent: null | string | undefined;
    if ("parent_id" in arguments_) {
        nextParent =
            arguments_.parent_id === null || arguments_.parent_id === ""
                ? null
                : requireUuid(arguments_.parent_id, "parent_id");
        if (nextParent === taskId) {
            throw new ToolInputError("A Task cannot be its own parent");
        }
    }

    const hasDetails =
        Object.keys(patch).length > 0 || nextLabels !== undefined;
    if (!hasDetails && nextParent === undefined) {
        throw new ToolInputError("No updatable fields were provided");
    }

    // Parent first: a new Subtask must drop epic_id before details apply, and
    // a former Subtask may join an Epic in the same call.
    if (nextParent !== undefined) {
        await setParent(taskId, nextParent, context);
    }

    if (hasDetails) {
        const { error } = await context.supabase.rpc("update_task_details", {
            p_label_ids: nextLabels ?? null,
            p_patch: patch,
            p_task_id: taskId,
        });
        if (error) throw new Error(error.message);
    }

    const { data: task, error: fetchError } = await context.supabase
        .from("tasks")
        .select(TASK_DETAIL_SELECT)
        .eq("id", taskId)
        .single();
    if (fetchError) throw new Error(fetchError.message);

    return {
        resourceId: taskId,
        resourceType: "task",
        text: jsonText({ task }),
    };
}

const RICH_TEXT_SCHEMA_DESCRIPTION = `Rich text. ${RICH_TEXT_FORMAT_HINT}`;

export const TOOLS: ToolDefinition[] = [
    {
        description:
            "Return the signed-in PlotOps user id, email, and OAuth client id.",
        handler: whoami,
        inputSchema: {
            additionalProperties: false,
            properties: {},
            type: "object",
        },
        name: "whoami",
        readOnly: true,
    },
    {
        description: "List PlotOps projects the signed-in user can view.",
        handler: listProjects,
        inputSchema: {
            additionalProperties: false,
            properties: {
                limit: { maximum: MAX_LIST_LIMIT, minimum: 1, type: "integer" },
            },
            type: "object",
        },
        name: "list_projects",
        readOnly: true,
    },
    {
        description:
            "List boards in a project, including columns (id, name, is_done).",
        handler: listBoards,
        inputSchema: {
            additionalProperties: false,
            properties: {
                project_id: { type: "string" },
            },
            required: ["project_id"],
            type: "object",
        },
        name: "list_boards",
        readOnly: true,
    },
    {
        description:
            "List people in a project's team (owner and members, any role) with user_id, display name and role. Use user_id for assignee_id or @mentions.",
        handler: listMembers,
        inputSchema: {
            additionalProperties: false,
            properties: {
                project_id: { type: "string" },
            },
            required: ["project_id"],
            type: "object",
        },
        name: "list_members",
        readOnly: true,
    },
    {
        description:
            "List Epics in a project with progress (task_count, done_count, points). Use id as epic_id on create_task / update_task.",
        handler: listEpics,
        inputSchema: {
            additionalProperties: false,
            properties: {
                include_archived: { type: "boolean" },
                project_id: { type: "string" },
            },
            required: ["project_id"],
            type: "object",
        },
        name: "list_epics",
        readOnly: true,
    },
    {
        description:
            "List tasks. Filter by project, board, column status, assignee (UUID from list_members, me, or unassigned), parent (Subtasks of a task), epic (Tasks in an Epic), and title/key search.",
        handler: listTasks,
        inputSchema: {
            additionalProperties: false,
            properties: {
                assignee_id: { type: "string" },
                board_id: { type: "string" },
                epic_id: {
                    description: "Only Tasks that belong to this Epic",
                    type: "string",
                },
                include_archived: { type: "boolean" },
                limit: { maximum: MAX_LIST_LIMIT, minimum: 1, type: "integer" },
                offset: { minimum: 0, type: "integer" },
                parent_id: {
                    description: "Only Subtasks of this Parent Task",
                    type: "string",
                },
                project_id: { type: "string" },
                q: { type: "string" },
                status: {
                    description: "Board column id",
                    type: "string",
                },
            },
            type: "object",
        },
        name: "list_tasks",
        readOnly: true,
    },
    {
        description:
            "Read one task with its comments, labels and structured relations: parent, subtasks, epic (epic_tasks when the task is an Epic) and links (blocks / blocked_by / relates_to, each with link_id).",
        handler: getTask,
        inputSchema: {
            additionalProperties: false,
            properties: {
                project_id: { type: "string" },
                task_id: { type: "string" },
                task_key: { type: "string" },
            },
            type: "object",
        },
        name: "get_task",
        readOnly: true,
    },
    {
        description:
            "Create a task on a board. Status defaults to the first column; type defaults to the board setting; author is the signed-in user. Set relations with fields, not description text: assignee_id (list_members), epic_id (list_epics), parent_id (creates a Subtask: it moves to the parent's board, first column and open Sprint). Add blocks/relates_to links afterwards with link_tasks.",
        handler: createTask,
        inputSchema: {
            additionalProperties: false,
            properties: {
                assignee_id: {
                    description: "user_id from list_members",
                    type: ["string", "null"],
                },
                board_id: { type: "string" },
                description: {
                    description: RICH_TEXT_SCHEMA_DESCRIPTION,
                    type: "string",
                },
                epic_color: {
                    description: `Badge colour, only for task_type epic: ${[...EPIC_COLORS].join(", ")}`,
                    type: "string",
                },
                epic_id: {
                    description:
                        "Epic this task belongs to (id from list_epics). Not for Subtasks or Epics.",
                    type: "string",
                },
                parent_id: {
                    description:
                        "Parent Task id: makes this a Subtask. Parent cannot be an Epic or a Subtask.",
                    type: "string",
                },
                priority: {
                    enum: [...PRIORITIES, null],
                    type: ["string", "null"],
                },
                project_id: { type: "string" },
                sprint_id: { type: "string" },
                status: { description: "Board column id", type: "string" },
                task_type: { enum: [...TASK_TYPES], type: "string" },
                title: { type: "string" },
            },
            required: ["board_id", "title"],
            type: "object",
        },
        name: "create_task",
        readOnly: false,
    },
    {
        description:
            "Update task fields (title, description, priority, deadline, assignee, type, estimate, epic, parent, labels). Pass null to clear assignee_id, epic_id or parent_id. Does not change status, author, or git/PR fields; use link_tasks for blocks/relates_to.",
        handler: updateTask,
        inputSchema: {
            additionalProperties: false,
            properties: {
                assignee_id: {
                    description: "user_id from list_members; null unassigns",
                    type: ["string", "null"],
                },
                deadline: { type: ["string", "null"] },
                description: {
                    description: RICH_TEXT_SCHEMA_DESCRIPTION,
                    type: ["string", "null"],
                },
                epic_color: { type: ["string", "null"] },
                epic_id: {
                    description:
                        "Epic id from list_epics; null removes the task from its Epic",
                    type: ["string", "null"],
                },
                estimate: { type: ["integer", "null"] },
                label_ids: { items: { type: "string" }, type: "array" },
                parent_id: {
                    description:
                        "Parent Task id (makes this a Subtask, moving it to the parent's board); null turns a Subtask back into a root task",
                    type: ["string", "null"],
                },
                priority: {
                    enum: [...PRIORITIES, null],
                    type: ["string", "null"],
                },
                task_id: { type: "string" },
                task_type: { enum: [...TASK_TYPES], type: "string" },
                title: { type: "string" },
            },
            required: ["task_id"],
            type: "object",
        },
        name: "update_task",
        readOnly: false,
    },
    {
        description:
            "Move a task to another board column (status). Appends at the end of the column. Uses the same Done-column gates as the kanban board.",
        handler: changeStatus,
        inputSchema: {
            additionalProperties: false,
            properties: {
                column_id: {
                    description: "Target board column id",
                    type: "string",
                },
                task_id: { type: "string" },
            },
            required: ["task_id", "column_id"],
            type: "object",
        },
        name: "change_status",
        readOnly: false,
    },
    {
        description:
            "Add a comment on a task. Optional parent_id replies to a root comment (one level).",
        handler: addComment,
        inputSchema: {
            additionalProperties: false,
            properties: {
                body: {
                    description: RICH_TEXT_SCHEMA_DESCRIPTION,
                    type: "string",
                },
                parent_id: { type: "string" },
                task_id: { type: "string" },
            },
            required: ["task_id", "body"],
            type: "object",
        },
        name: "add_comment",
        readOnly: false,
    },
    {
        description:
            "Link two tasks in the same project, as in the task drawer. kind blocks: source blocks target (target cannot enter Done while source is open; cycles rejected). kind relates_to: undirected. Parent/Subtask pairs cannot be linked — use parent_id instead.",
        handler: linkTasks,
        inputSchema: {
            additionalProperties: false,
            properties: {
                kind: { enum: [...LINK_KINDS], type: "string" },
                source_task_id: { type: "string" },
                target_task_id: { type: "string" },
            },
            required: ["source_task_id", "target_task_id", "kind"],
            type: "object",
        },
        name: "link_tasks",
        readOnly: false,
    },
    {
        description: "Remove a task link by link_id (from get_task links).",
        handler: unlinkTasks,
        inputSchema: {
            additionalProperties: false,
            properties: {
                link_id: { type: "string" },
            },
            required: ["link_id"],
            type: "object",
        },
        name: "unlink_tasks",
        readOnly: false,
    },
];

export async function callTool(
    name: string,
    rawArguments: unknown,
    context: ToolContext
): Promise<ToolResult> {
    const tool = TOOLS.find((item) => item.name === name);
    if (!tool) {
        throw new ToolInputError(`Unknown tool: ${name}`);
    }
    return tool.handler(asRecord(rawArguments), context);
}

export function toolListPayload() {
    return {
        tools: TOOLS.map((tool) => ({
            annotations: { readOnlyHint: tool.readOnly },
            description: tool.description,
            inputSchema: tool.inputSchema,
            name: tool.name,
        })),
    };
}
