import { describe, expect, it } from "vitest";

import { callTool, TASK_DETAIL_SELECT, ToolInputError } from "./tools.ts";

describe("tool input validation", () => {
    const context = {
        clientId: null,
        supabase: {} as never,
        user: { id: "user-1" } as never,
    };

    it("requires project_id or board_id for list_tasks", async () => {
        await expect(
            callTool("list_tasks", {}, context)
        ).rejects.toBeInstanceOf(ToolInputError);
    });

    it("rejects unknown tools", async () => {
        await expect(callTool("explode", {}, context)).rejects.toBeInstanceOf(
            ToolInputError
        );
    });

    it("requires a UUID board_id for create_task", async () => {
        await expect(
            callTool("create_task", { board_id: "nope", title: "Hi" }, context)
        ).rejects.toBeInstanceOf(ToolInputError);
    });

    it("does not accept author_id or PR fields on update_task", async () => {
        await expect(
            callTool(
                "update_task",
                {
                    author_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                    task_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                },
                context
            )
        ).rejects.toBeInstanceOf(ToolInputError);
    });
});

const TASK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REMOVED_TASK_COLUMNS = ["branch_name", "pr_number", "pr_state", "pr_url"];
const GIT_LINKS = [
    {
        branch_name: "feat/web",
        pr_number: 12,
        pr_state: "open",
        pr_url: "https://github.com/acme/web/pull/12",
        repository: {
            github_full_name: "acme/web",
            github_html_url: "https://github.com/acme/web",
        },
        repository_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    },
];

function contextWith(supabase: never) {
    return { clientId: null, supabase, user: { id: "user-1" } as never };
}

function fakeQuery(table: string) {
    const data = rowsFor(table);
    const query: object = Object.assign(
        Promise.resolve({ data, error: null }),
        {
            eq: () => query,
            in: () => query,
            is: () => query,
            limit: () => query,
            or: () => query,
            order: () => query,
            range: () => query,
            single: () => Promise.resolve({ data: data[0], error: null }),
        }
    );
    return query;
}

function fakeSupabase() {
    const selects: { columns: string; table: string }[] = [];
    const rpcs: { args?: Record<string, unknown>; fn: string }[] = [];

    const supabase = {
        auth: {},
        from: (table: string) => ({
            select: (columns: string) => {
                selects.push({ columns, table });
                return fakeQuery(table);
            },
        }),
        rpc: (fn: string, args?: Record<string, unknown>) => {
            rpcs.push({ args, fn });
            return Promise.resolve({ data: TASK_ID, error: null });
        },
    };
    return { rpcs, selects, supabase: supabase as never };
}

function rowsFor(table: string) {
    return table === "tasks"
        ? [{ git_links: GIT_LINKS, id: TASK_ID, task_key: "WEB-1" }]
        : [];
}

/** Top-level columns only: embedded resources `alias:table(...)` are dropped. */
function taskColumns(select: string): string[] {
    return select
        .replaceAll(/\w+:\w+\((?:[^()]|\([^()]*\))*\)/g, "")
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean);
}

describe("tools on the multi-repo schema", () => {
    it("does not select columns dropped from tasks", () => {
        const columns = taskColumns(TASK_DETAIL_SELECT);
        for (const removed of REMOVED_TASK_COLUMNS) {
            expect(columns).not.toContain(removed);
        }
        expect(TASK_DETAIL_SELECT).toContain("git_links:task_git_links(");
        expect(TASK_DETAIL_SELECT).toContain(
            "repository:project_repositories("
        );
    });

    it("get_task returns git links per Repository", async () => {
        const fake = fakeSupabase();
        const result = await callTool(
            "get_task",
            { task_id: TASK_ID },
            contextWith(fake.supabase)
        );
        const payload = JSON.parse(result.text) as {
            task: { git_links: unknown };
        };
        expect(payload.task.git_links).toEqual(GIT_LINKS);
        expect(fake.selects[0]).toEqual({
            columns: TASK_DETAIL_SELECT,
            table: "tasks",
        });
    });

    it("update_task never forwards git fields to update_task_details", async () => {
        const fake = fakeSupabase();
        await callTool(
            "update_task",
            {
                branch_name: "feat/x",
                pr_number: 7,
                pr_state: "merged",
                pr_url: "https://github.com/acme/web/pull/7",
                repository_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                task_id: TASK_ID,
                title: "Renamed",
            },
            contextWith(fake.supabase)
        );
        expect(fake.rpcs).toEqual([
            {
                args: {
                    p_label_ids: null,
                    p_patch: { title: "Renamed" },
                    p_task_id: TASK_ID,
                },
                fn: "update_task_details",
            },
        ]);
        expect(fake.selects.map((s) => s.columns)).toEqual([
            TASK_DETAIL_SELECT,
        ]);
    });
});

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OTHER_PARENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OWNER_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

type Filter = [string, ...unknown[]];

/** Table rows are returned for every select; filters are recorded, not applied. */
function scriptedSupabase(tables: Record<string, unknown[]>) {
    const queries: { filters: Filter[]; table: string }[] = [];
    const rpcs: { args?: Record<string, unknown>; fn: string }[] = [];

    const builder = (table: string) => {
        const filters: Filter[] = [];
        queries.push({ filters, table });
        const data = tables[table] ?? [];
        const query: object = Object.assign(
            Promise.resolve({ data, error: null }),
            Object.fromEntries(
                ["eq", "in", "is", "limit", "or", "order", "range"].map(
                    (method) => [
                        method,
                        (...args: unknown[]) => {
                            filters.push([method, ...args]);
                            return query;
                        },
                    ]
                )
            ),
            { single: () => Promise.resolve({ data: data[0], error: null }) }
        );
        return query;
    };

    const supabase = {
        from: (table: string) => ({ select: () => builder(table) }),
        rpc: (fn: string, args?: Record<string, unknown>) => {
            rpcs.push({ args, fn });
            return Promise.resolve({
                data: fn === "create_task" ? TASK_ID : null,
                error: null,
            });
        },
    };
    return { queries, rpcs, supabase: supabase as never };
}

describe("rich text descriptions", () => {
    it("rejects Markdown descriptions with an HTML hint", async () => {
        const fake = scriptedSupabase({ tasks: [{ id: TASK_ID }] });
        await expect(
            callTool(
                "create_task",
                {
                    board_id: TASK_ID,
                    description: "## Goal\n\n- one\n- two",
                    title: "Hi",
                },
                contextWith(fake.supabase)
            )
        ).rejects.toThrow(/looks like Markdown[\s\S]*NOT Markdown/);
        expect(fake.rpcs).toEqual([]);
    });

    it("rejects Markdown in update_task and add_comment", async () => {
        const fake = scriptedSupabase({});
        await expect(
            callTool(
                "update_task",
                { description: "Fix **this** now", task_id: TASK_ID },
                contextWith(fake.supabase)
            )
        ).rejects.toBeInstanceOf(ToolInputError);
        await expect(
            callTool(
                "add_comment",
                { body: "1. first\n2. second", task_id: TASK_ID },
                contextWith(fake.supabase)
            )
        ).rejects.toBeInstanceOf(ToolInputError);
    });

    it("accepts HTML and plain prose", async () => {
        for (const description of [
            "<h2>Goal</h2><ul><li><p>one</p></li></ul>",
            "Just a sentence about the bug.",
        ]) {
            const fake = scriptedSupabase({ tasks: [{ id: TASK_ID }] });
            await callTool(
                "create_task",
                { board_id: TASK_ID, description, title: "Hi" },
                contextWith(fake.supabase)
            );
            expect(fake.rpcs[0]?.args?.p_options).toEqual({ description });
        }
    });

    it("tells agents about the editor format in schemas and instructions", async () => {
        const { SERVER_INSTRUCTIONS } = await import("./mcp.ts");
        const { TOOLS } = await import("./tools.ts");
        const schemaText = (name: string, field: string) => {
            const tool = TOOLS.find((item) => item.name === name)!;
            const properties = tool.inputSchema.properties as Record<
                string,
                { description?: string }
            >;
            return properties[field]?.description ?? "";
        };
        expect(schemaText("create_task", "description")).toMatch(
            /NOT Markdown/
        );
        expect(schemaText("update_task", "description")).toMatch(
            /NOT Markdown/
        );
        expect(schemaText("add_comment", "body")).toMatch(/NOT Markdown/);
        expect(SERVER_INSTRUCTIONS).toMatch(/NOT Markdown/);
        expect(SERVER_INSTRUCTIONS).toMatch(/list_members/);
        expect(SERVER_INSTRUCTIONS).toMatch(/link_tasks/);
    });
});

describe("task structure fields", () => {
    it("create_task with parent_id attaches the new task as a Subtask", async () => {
        const fake = scriptedSupabase({ tasks: [{ id: TASK_ID }] });
        await callTool(
            "create_task",
            { board_id: TASK_ID, parent_id: PARENT_ID, title: "Child" },
            contextWith(fake.supabase)
        );
        expect(fake.rpcs.map((call) => call.fn)).toEqual([
            "create_task",
            "set_task_parent",
        ]);
        expect(fake.rpcs[1]?.args).toEqual({
            p_child_id: TASK_ID,
            p_parent_id: PARENT_ID,
        });
    });

    it("create_task refuses a Subtask that also carries epic_id", async () => {
        const fake = scriptedSupabase({});
        await expect(
            callTool(
                "create_task",
                {
                    board_id: TASK_ID,
                    epic_id: OTHER_PARENT_ID,
                    parent_id: PARENT_ID,
                    title: "Child",
                },
                contextWith(fake.supabase)
            )
        ).rejects.toBeInstanceOf(ToolInputError);
        expect(fake.rpcs).toEqual([]);
    });

    it("update_task re-parents by clearing the old parent first", async () => {
        const fake = scriptedSupabase({
            tasks: [{ id: TASK_ID, parent_id: OTHER_PARENT_ID }],
        });
        await callTool(
            "update_task",
            { parent_id: PARENT_ID, task_id: TASK_ID },
            contextWith(fake.supabase)
        );
        expect(fake.rpcs).toEqual([
            { args: { p_task_id: TASK_ID }, fn: "clear_task_parent" },
            {
                args: { p_child_id: TASK_ID, p_parent_id: PARENT_ID },
                fn: "set_task_parent",
            },
        ]);
    });

    it("update_task parent_id null only clears the parent", async () => {
        const fake = scriptedSupabase({
            tasks: [{ id: TASK_ID, parent_id: PARENT_ID }],
        });
        await callTool(
            "update_task",
            { parent_id: null, task_id: TASK_ID },
            contextWith(fake.supabase)
        );
        expect(fake.rpcs.map((call) => call.fn)).toEqual(["clear_task_parent"]);
    });

    it("link_tasks validates kind and calls create_task_link", async () => {
        const fake = scriptedSupabase({});
        await expect(
            callTool(
                "link_tasks",
                {
                    kind: "parent_of",
                    source_task_id: TASK_ID,
                    target_task_id: PARENT_ID,
                },
                contextWith(fake.supabase)
            )
        ).rejects.toBeInstanceOf(ToolInputError);

        await callTool(
            "link_tasks",
            {
                kind: "blocks",
                source_task_id: TASK_ID,
                target_task_id: PARENT_ID,
            },
            contextWith(fake.supabase)
        );
        expect(fake.rpcs).toEqual([
            {
                args: {
                    p_kind: "blocks",
                    p_source_task_id: TASK_ID,
                    p_target_task_id: PARENT_ID,
                },
                fn: "create_task_link",
            },
        ]);
    });

    it("get_task reports links from the task's point of view", async () => {
        const blocker = { id: PARENT_ID, task_key: "WEB-2" };
        const related = { id: OTHER_PARENT_ID, task_key: "WEB-3" };
        const fake = scriptedSupabase({
            task_comments: [],
            task_labels: [],
            task_links: [
                {
                    id: "link-1",
                    kind: "blocks",
                    source: blocker,
                    source_task_id: PARENT_ID,
                    target: { id: TASK_ID },
                    target_task_id: TASK_ID,
                },
                {
                    id: "link-2",
                    kind: "relates_to",
                    source: { id: TASK_ID },
                    source_task_id: TASK_ID,
                    target: related,
                    target_task_id: OTHER_PARENT_ID,
                },
            ],
            tasks: [
                {
                    epic_id: null,
                    id: TASK_ID,
                    parent_id: null,
                    task_key: "WEB-1",
                    task_type: "task",
                },
            ],
        });
        const result = await callTool(
            "get_task",
            { task_id: TASK_ID },
            contextWith(fake.supabase)
        );
        const payload = JSON.parse(result.text) as {
            epic: unknown;
            links: unknown[];
            parent: unknown;
        };
        expect(payload.parent).toBeNull();
        expect(payload.epic).toBeNull();
        expect(payload.links).toEqual([
            {
                kind: "blocks",
                link_id: "link-1",
                relation: "blocked_by",
                task: blocker,
            },
            {
                kind: "relates_to",
                link_id: "link-2",
                relation: "relates_to",
                task: related,
            },
        ]);
    });
});

describe("list_members", () => {
    it("returns the Team Owner and Members with assignable user ids", async () => {
        const fake = scriptedSupabase({
            profiles: [
                {
                    first_name: "Olga",
                    id: OWNER_ID,
                    last_name: "Owner",
                    username: "olga",
                },
            ],
            projects: [
                { id: TASK_ID, team: { owner_id: OWNER_ID }, team_id: "t1" },
            ],
            team_members: [
                {
                    profile: {
                        first_name: null,
                        id: USER_A,
                        last_name: null,
                        username: "alex",
                    },
                    role: "contributor",
                    user_id: USER_A,
                },
                { profile: null, role: "admin", user_id: OWNER_ID },
            ],
        });
        const result = await callTool(
            "list_members",
            { project_id: TASK_ID },
            contextWith(fake.supabase)
        );
        expect(JSON.parse(result.text)).toEqual({
            members: [
                {
                    is_owner: false,
                    name: "alex",
                    role: "contributor",
                    user_id: USER_A,
                    username: "alex",
                },
                {
                    is_owner: true,
                    name: "Olga Owner",
                    role: "owner",
                    user_id: OWNER_ID,
                    username: "olga",
                },
            ],
        });
        const members = fake.queries.find((q) => q.table === "team_members");
        expect(members?.filters).toContainEqual(["eq", "team_id", "t1"]);
    });
});
