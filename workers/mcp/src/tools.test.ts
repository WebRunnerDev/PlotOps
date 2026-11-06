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
