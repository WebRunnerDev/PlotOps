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
    "deadline",
    "estimate",
    "archived_at",
    "created_at",
].join(", ");

const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT}, description, epic_id, epic_color, sprint_id, parent_id, branch_name, pr_number, pr_state, pr_url`;

const COMMENT_SELECT =
    "id, task_id, parent_id, body, author_id, created_at, updated_at";

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
        options.description = description;
    }

    const id = await rpcResult(
        context.supabase.rpc("create_task", {
            p_board_id: boardId,
            p_options: options,
            p_title: title,
        })
    );

    const { data: task, error } = await context.supabase
        .from("tasks")
        .select(TASK_DETAIL_SELECT)
        .eq("id", id)
        .single();
    if (error) throw new Error(error.message);

    return {
        resourceId: typeof id === "string" ? id : null,
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

    return {
        resourceId: task.id,
        resourceType: "task",
        text: jsonText({
            comments: comments ?? [],
            labels: labels ?? [],
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

async function addComment(
    arguments_: Record<string, unknown>,
    context: ToolContext
): Promise<ToolResult> {
    const taskId = requireUuid(arguments_.task_id, "task_id");
    const body = requireString(arguments_.body, "body");
    if (body.length > MAX_COMMENT_LENGTH) {
        throw new ToolInputError("body is too long");
    }
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

    if (Object.keys(patch).length === 0 && nextLabels === undefined) {
        throw new ToolInputError("No updatable fields were provided");
    }

    const { error } = await context.supabase.rpc("update_task_details", {
        p_label_ids: nextLabels ?? null,
        p_patch: patch,
        p_task_id: taskId,
    });
    if (error) throw new Error(error.message);

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
            "List tasks. Filter by project, board, column status, assignee (UUID, me, or unassigned), and title/key search.",
        handler: listTasks,
        inputSchema: {
            additionalProperties: false,
            properties: {
                assignee_id: { type: "string" },
                board_id: { type: "string" },
                include_archived: { type: "boolean" },
                limit: { maximum: MAX_LIST_LIMIT, minimum: 1, type: "integer" },
                offset: { minimum: 0, type: "integer" },
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
            "Read one task and its comments (optional one-level replies).",
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
            "Create a task on a board. Status defaults to the first column; type defaults to the board setting; author is the signed-in user.",
        handler: createTask,
        inputSchema: {
            additionalProperties: false,
            properties: {
                assignee_id: { type: ["string", "null"] },
                board_id: { type: "string" },
                description: { type: "string" },
                epic_color: { type: "string" },
                epic_id: { type: "string" },
                priority: { type: ["string", "null"] },
                project_id: { type: "string" },
                sprint_id: { type: "string" },
                status: { description: "Board column id", type: "string" },
                task_type: { type: "string" },
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
            "Update task fields (title, description, priority, deadline, assignee, type, estimate, epic, labels). Does not change status, author, or git/PR fields.",
        handler: updateTask,
        inputSchema: {
            additionalProperties: false,
            properties: {
                assignee_id: { type: ["string", "null"] },
                deadline: { type: ["string", "null"] },
                description: { type: ["string", "null"] },
                epic_color: { type: ["string", "null"] },
                epic_id: { type: ["string", "null"] },
                estimate: { type: ["integer", "null"] },
                label_ids: { items: { type: "string" }, type: "array" },
                priority: { type: ["string", "null"] },
                task_id: { type: "string" },
                task_type: { type: "string" },
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
                body: { type: "string" },
                parent_id: { type: "string" },
                task_id: { type: "string" },
            },
            required: ["task_id", "body"],
            type: "object",
        },
        name: "add_comment",
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
