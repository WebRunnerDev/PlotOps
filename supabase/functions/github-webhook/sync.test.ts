import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { beforeEach, describe, expect, it } from "vitest";

import {
    syncClosedPullRequest,
    syncMergedPullRequest,
    syncOpenedPullRequest,
} from "./sync";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/**
 * In-memory stand-in for the PostgREST calls sync.ts makes: select / eq /
 * order / limit / maybeSingle, the embedded `task_git_links (...)` select,
 * insert, update, upsert on `task_id,repository_id`, and rpc.
 */
function createFakeSupabase(tables: Tables) {
    const rpcCalls: { args: Row; name: string }[] = [];

    class Query implements PromiseLike<{ data: unknown; error: null }> {
        private filters: [string, unknown][] = [];
        private limitTo: null | number = null;
        private op: "insert" | "select" | "update" | "upsert" = "select";
        private orderBy: null | { ascending: boolean; column: string } = null;
        private payload: Row = {};
        private selectColumns = "*";
        private single = false;

        constructor(private readonly table: string) {}

        eq(column: string, value: unknown) {
            this.filters.push([column, value]);
            return this;
        }

        insert(payload: Row) {
            this.op = "insert";
            this.payload = payload;
            return this;
        }

        limit(count: number) {
            this.limitTo = count;
            return this;
        }

        maybeSingle() {
            this.single = true;
            return this;
        }

        order(column: string, options: { ascending: boolean }) {
            this.orderBy = { ascending: options.ascending, column };
            return this;
        }

        select(columns: string) {
            this.selectColumns = columns;
            return this;
        }

        // eslint-disable-next-line unicorn/no-thenable -- PostgREST builders are awaited
        then: PromiseLike<{ data: unknown; error: null }>["then"] = (
            onFulfilled,
            onRejected
        ) => Promise.resolve(this.run()).then(onFulfilled, onRejected);

        update(payload: Row) {
            this.op = "update";
            this.payload = payload;
            return this;
        }

        upsert(payload: Row) {
            this.op = "upsert";
            this.payload = payload;
            return this;
        }

        private rows(): Row[] {
            const own = this.filters.filter(
                ([column]) => !column.includes(".")
            );
            return (tables[this.table] ??= []).filter((row) =>
                own.every(([column, value]) => row[column] === value)
            );
        }

        private run(): { data: unknown; error: null } {
            const table = (tables[this.table] ??= []);

            if (this.op === "insert") {
                table.push({ ...this.payload });
                return { data: null, error: null };
            }

            if (this.op === "update") {
                for (const row of this.rows()) Object.assign(row, this.payload);
                return { data: null, error: null };
            }

            if (this.op === "upsert") {
                const existing = table.find(
                    (row) =>
                        row.task_id === this.payload.task_id &&
                        row.repository_id === this.payload.repository_id
                );
                if (existing) {
                    Object.assign(existing, this.payload);
                } else {
                    table.push({ branch_name: null, ...this.payload });
                }
                return { data: null, error: null };
            }

            let rows = this.rows().map((row) => ({ ...row }));

            if (this.selectColumns.includes("task_git_links (")) {
                const linkFilters = this.filters
                    .filter(([column]) => column.startsWith("task_git_links."))
                    .map(([column, value]) => [column.split(".")[1], value]);
                rows = rows.map((row) => ({
                    ...row,
                    task_git_links: (tables.task_git_links ?? [])
                        .filter((link) => link.task_id === row.id)
                        .filter((link) =>
                            linkFilters.every(
                                ([column, value]) =>
                                    link[column as string] === value
                            )
                        ),
                }));
            }

            if (this.orderBy) {
                const { ascending, column } = this.orderBy;
                rows.sort(
                    (a, b) =>
                        ((a[column] as number) - (b[column] as number)) *
                        (ascending ? 1 : -1)
                );
            }

            if (this.limitTo !== null) rows = rows.slice(0, this.limitTo);

            return {
                data: this.single ? (rows[0] ?? null) : rows,
                error: null,
            };
        }
    }

    const client = {
        from: (table: string) => new Query(table),
        rpc: (name: string, arguments_: Row) => {
            rpcCalls.push({ args: arguments_, name });
            return Promise.resolve({ data: null, error: null });
        },
    };

    return { client: client as unknown as SupabaseClient, rpcCalls };
}

const WEB = { github: 101, id: "repo-web", name: "acme/web" };
const API = { github: 202, id: "repo-api", name: "acme/api" };

function addLink(
    tables: Tables,
    taskId: string,
    repo: typeof WEB,
    link: { branch_name?: string; pr_number?: number; pr_state?: string }
) {
    tables.task_git_links.push({
        branch_name: null,
        pr_number: null,
        pr_state: null,
        pr_url: null,
        project_id: "project-1",
        repository_id: repo.id,
        task_id: taskId,
        ...link,
    });
}

function addTask(tables: Tables, id: string, taskKey: string) {
    tables.tasks.push({
        archived_at: null,
        board_id: "board-1",
        id,
        parent_id: null,
        position: 0,
        project_id: "project-1",
        status: "review",
        task_key: taskKey,
    });
}

function link(tables: Tables, taskId: string, repo: typeof WEB) {
    return tables.task_git_links.find(
        (row) => row.task_id === taskId && row.repository_id === repo.id
    );
}

function payload(
    repo: typeof WEB,
    pr: { base?: string; head: string; merged?: boolean; number: number },
    action = "closed"
) {
    return {
        action,
        pull_request: {
            base: { ref: pr.base ?? (repo === WEB ? "main" : "develop") },
            head: { ref: pr.head },
            html_url: `https://github.com/${repo.name}/pull/${pr.number}`,
            merged: pr.merged ?? (action === "closed" ? true : undefined),
            number: pr.number,
        },
        repository: { full_name: repo.name, id: repo.github },
    };
}

function seed(): Tables {
    return {
        activity_log: [],
        board_columns: [
            {
                board_id: "board-1",
                id: "todo",
                is_done: false,
                name: "To do",
                position: 0,
            },
            {
                board_id: "board-1",
                id: "review",
                is_done: false,
                name: "Review",
                position: 1,
            },
            {
                board_id: "board-1",
                id: "done",
                is_done: true,
                name: "Done",
                position: 2,
            },
        ],
        board_repositories: [
            { base_branch: "main", board_id: "board-1", repository_id: WEB.id },
            {
                base_branch: "develop",
                board_id: "board-1",
                repository_id: API.id,
            },
        ],
        boards: [
            {
                id: "board-1",
                merge_target_column_id: null,
                merge_target_mode: "last_column",
            },
        ],
        project_repositories: [
            { github_repo_id: WEB.github, id: WEB.id, project_id: "project-1" },
            { github_repo_id: API.github, id: API.id, project_id: "project-1" },
        ],
        task_git_links: [],
        tasks: [],
    };
}

const status = (tables: Tables, id: string) =>
    tables.tasks.find((task) => task.id === id)?.status;

describe("github-webhook sync across Repositories", () => {
    let tables: Tables;
    let fake: ReturnType<typeof createFakeSupabase>;
    const logs: Row[] = [];
    const log = (fields: Row) => logs.push(fields);

    beforeEach(() => {
        tables = seed();
        fake = createFakeSupabase(tables);
        logs.length = 0;
    });

    it("maps equal PR numbers in two Repositories to different Tasks", async () => {
        addTask(tables, "web-task", "TASK-1");
        addTask(tables, "api-task", "TASK-2");
        addLink(tables, "web-task", WEB, { pr_number: 12, pr_state: "open" });
        addLink(tables, "api-task", API, { pr_number: 12, pr_state: "open" });

        const result = await syncMergedPullRequest(
            fake.client,
            payload(API, { head: "feature/no-key", number: 12 }),
            log
        );

        expect(result).toMatchObject({ skipped: false, taskId: "api-task" });
        expect(status(tables, "api-task")).toBe("done");
        expect(status(tables, "web-task")).toBe("review");
        expect(link(tables, "web-task", WEB)?.pr_state).toBe("open");
    });

    it("waits for the second PR before moving a Task", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { pr_number: 1, pr_state: "open" });
        addLink(tables, "t1", API, { pr_number: 2, pr_state: "open" });

        await syncMergedPullRequest(
            fake.client,
            payload(WEB, { head: "feature/TASK-1-ui", number: 1 }),
            log
        );

        expect(link(tables, "t1", WEB)?.pr_state).toBe("merged");
        expect(status(tables, "t1")).toBe("review");
        expect(fake.rpcCalls).toEqual([]);
        // The first merge records the PR change only.
        expect(tables.activity_log).toHaveLength(1);
        expect(
            (tables.activity_log[0].metadata as { changes: Row[] }).changes
        ).toEqual([expect.objectContaining({ field: "pr" })]);

        // Redelivery of the first merge changes nothing.
        expect(
            await syncMergedPullRequest(
                fake.client,
                payload(WEB, { head: "feature/TASK-1-ui", number: 1 }),
                log
            )
        ).toMatchObject({ reason: "pending_prs", skipped: true });

        await syncMergedPullRequest(
            fake.client,
            payload(API, { head: "feature/TASK-1-api", number: 2 }),
            log
        );

        expect(status(tables, "t1")).toBe("done");
        expect(fake.rpcCalls.map((call) => call.name)).toEqual([
            "create_notifications_for_status_change",
        ]);
        expect(
            (tables.activity_log[1].metadata as { changes: Row[] }).changes
        ).toEqual([
            expect.objectContaining({ field: "status" }),
            expect.objectContaining({ field: "pr" }),
        ]);
    });

    it("moves on the first PR when the second closes without merge", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { pr_number: 1, pr_state: "open" });
        addLink(tables, "t1", API, { pr_number: 2, pr_state: "open" });

        await syncMergedPullRequest(
            fake.client,
            payload(WEB, { head: "feature/TASK-1-ui", number: 1 }),
            log
        );
        expect(status(tables, "t1")).toBe("review");

        await syncClosedPullRequest(
            fake.client,
            payload(API, {
                head: "feature/TASK-1-api",
                merged: false,
                number: 2,
            }),
            log
        );

        expect(link(tables, "t1", API)?.pr_state).toBe("closed");
        expect(status(tables, "t1")).toBe("done");
        expect(fake.rpcCalls).toHaveLength(1);
    });

    it("does not move a Task when its PR merges outside the Base branch", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", API, { pr_number: 2, pr_state: "open" });

        const result = await syncMergedPullRequest(
            fake.client,
            payload(API, { base: "main", head: "feature/TASK-1", number: 2 }),
            log
        );

        expect(result).toMatchObject({ reason: "wrong_base", skipped: true });
        expect(status(tables, "t1")).toBe("review");
        expect(link(tables, "t1", API)?.pr_state).toBe("open");
    });

    it("ignores branch-only Git links when deciding the merge", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { pr_number: 1, pr_state: "open" });
        addLink(tables, "t1", API, { branch_name: "feature/TASK-1-api" });

        await syncMergedPullRequest(
            fake.client,
            payload(WEB, { head: "feature/TASK-1-ui", number: 1 }),
            log
        );

        expect(status(tables, "t1")).toBe("done");
    });

    it("auto-links a second Repository and never overwrites the Git link", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { pr_number: 5, pr_state: "open" });

        await syncOpenedPullRequest(
            fake.client,
            payload(API, { head: "feature/TASK-1-api", number: 9 }, "opened"),
            log
        );

        expect(link(tables, "t1", API)).toMatchObject({
            branch_name: "feature/TASK-1-api",
            pr_number: 9,
            pr_state: "open",
            pr_url: "https://github.com/acme/api/pull/9",
        });
        expect(link(tables, "t1", WEB)).toMatchObject({ pr_number: 5 });

        const conflict = await syncOpenedPullRequest(
            fake.client,
            payload(API, { head: "fix/TASK-1-other", number: 10 }, "opened"),
            log
        );

        expect(conflict).toMatchObject({
            reason: "link_conflict",
            skipped: true,
        });
        expect(link(tables, "t1", API)).toMatchObject({
            branch_name: "feature/TASK-1-api",
            pr_number: 9,
        });
        expect(logs).toContainEqual(
            expect.objectContaining({
                linkedPr: 9,
                pr: 10,
                reason: "link_conflict",
                taskId: "t1",
            })
        );
    });

    it("auto-links on merge and moves the Task when that completes the set", async () => {
        addTask(tables, "t1", "TASK-1");

        await syncMergedPullRequest(
            fake.client,
            payload(WEB, { head: "feature/TASK-1-ui", number: 3 }),
            log
        );

        expect(link(tables, "t1", WEB)).toMatchObject({
            branch_name: "feature/TASK-1-ui",
            pr_number: 3,
            pr_state: "merged",
        });
        expect(status(tables, "t1")).toBe("done");
    });

    it("resolves the Repository by GitHub repo id, not full name", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { pr_number: 1, pr_state: "open" });

        const renamed = payload(WEB, { head: "feature/TASK-1", number: 1 });
        renamed.repository.full_name = "acme/web-renamed";

        await syncMergedPullRequest(fake.client, renamed, log);
        expect(status(tables, "t1")).toBe("done");

        const unknown = payload(WEB, { head: "feature/TASK-1", number: 1 });
        unknown.repository.id = 999;
        expect(
            await syncMergedPullRequest(fake.client, unknown, log)
        ).toMatchObject({ reason: "no_project", skipped: true });
    });
});
