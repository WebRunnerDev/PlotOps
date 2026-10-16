import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { describe, expect, it } from "vitest";

import { syncClosedPullRequest, syncMergedPullRequest } from "./sync";

/**
 * PostgREST stand-in: one response is at most 1000 rows unless the caller
 * pages with `.range()`. Mirrors `max_rows` in supabase/config.toml.
 */
const MAX_ROWS = 1000;

type Filter = {
    column: string;
    op: "eq" | "is";
    value: unknown;
};

type MockState = {
    rows: Row[];
    updates: Array<{ id: unknown; table: string; values: Row }>;
};

type Row = Record<string, unknown>;

function createMock(rows: Row[]): { client: SupabaseClient; state: MockState } {
    const state: MockState = { rows, updates: [] };

    class Query implements PromiseLike<{ data: unknown; error: null }> {
        private filters: Filter[] = [];
        private limitCount: number | undefined;
        private op: "insert" | "select" | "update" = "select";
        private rangeBounds: undefined | { from: number; to: number };
        private updateValues: Row | undefined;

        constructor(private readonly table: string) {}

        eq(column: string, value: unknown) {
            this.filters.push({ column, op: "eq", value });
            return this;
        }

        insert() {
            this.op = "insert";
            return this;
        }

        is(column: string, value: unknown) {
            this.filters.push({ column, op: "is", value });
            return this;
        }

        limit(count: number) {
            this.limitCount = count;
            return this;
        }

        maybeSingle() {
            const { data } = this.execute();
            const row = Array.isArray(data) ? (data[0] ?? null) : data;
            return Promise.resolve({ data: row, error: null });
        }

        order() {
            return this;
        }

        range(from: number, to: number) {
            this.rangeBounds = { from, to };
            return this;
        }

        select() {
            this.op = "select";
            return this;
        }

        // Awaited like the Supabase query builder, so this class is thenable.
        // eslint-disable-next-line unicorn/no-thenable
        then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
            onfulfilled?:
                | ((value: {
                      data: unknown;
                      error: null;
                  }) => PromiseLike<TResult1> | TResult1)
                | null,
            onrejected?:
                ((reason: unknown) => PromiseLike<TResult2> | TResult2) | null
        ): PromiseLike<TResult1 | TResult2> {
            return Promise.resolve(this.execute()).then(
                onfulfilled,
                onrejected
            );
        }

        update(values: Row) {
            this.op = "update";
            this.updateValues = values;
            return this;
        }

        private execute(): { data: unknown; error: null } {
            if (this.op === "insert") {
                return { data: null, error: null };
            }

            if (this.op === "update") {
                const id = this.filters.find(
                    (filter) => filter.column === "id"
                )?.value;
                state.updates.push({
                    id,
                    table: this.table,
                    values: this.updateValues ?? {},
                });
                return { data: null, error: null };
            }

            let matched = state.rows.filter(
                (row) =>
                    row.table === this.table &&
                    this.filters.every(
                        (filter) => row[filter.column] === filter.value
                    )
            );

            if (this.table === "tasks") {
                matched = [...matched].toSorted((left, right) =>
                    String(left.id).localeCompare(String(right.id))
                );
            }

            if (this.rangeBounds) {
                matched = matched.slice(
                    this.rangeBounds.from,
                    this.rangeBounds.to + 1
                );
            }
            if (matched.length > MAX_ROWS) {
                matched = matched.slice(0, MAX_ROWS);
            }
            if (this.limitCount !== undefined) {
                matched = matched.slice(0, this.limitCount);
            }

            return { data: matched, error: null };
        }
    }

    const client = {
        from(table: string) {
            return new Query(table);
        },
        rpc() {
            return Promise.resolve({ error: null });
        },
    };

    return { client: client as unknown as SupabaseClient, state };
}

function task(partial: Row): Row {
    return {
        archived_at: null,
        board_id: "board-1",
        branch_name: null,
        parent_id: null,
        pr_number: null,
        pr_state: null,
        project_id: "project-1",
        status: "todo",
        table: "tasks",
        task_key: "TASK-X",
        ...partial,
    };
}

const log = () => {};

describe("syncClosedPullRequest task matching", () => {
    it("still closes the linked task when archived rows fill the first page", async () => {
        const archived = Array.from({ length: MAX_ROWS }, (_, index) =>
            task({
                archived_at: "2026-01-01T00:00:00Z",
                id: `a${String(index).padStart(4, "0")}`,
                pr_number: null,
                task_key: `OLD-${index}`,
            })
        );
        const linked = task({
            id: "z-linked",
            pr_number: 7,
            pr_state: "open",
            task_key: "TASK-9",
        });
        const { client, state } = createMock([
            {
                github_full_name: "acme/repo",
                id: "project-1",
                table: "projects",
            },
            ...archived,
            linked,
        ]);

        const result = await syncClosedPullRequest(
            client,
            {
                action: "closed",
                pull_request: {
                    head: { ref: "feature/TASK-9-login" },
                    html_url: "https://github.com/acme/repo/pull/7",
                    merged: false,
                    number: 7,
                },
                repository: { full_name: "acme/repo" },
            },
            log
        );

        expect(result).toMatchObject({
            skipped: false,
            taskId: "z-linked",
        });
        expect(state.updates).toEqual([
            {
                id: "z-linked",
                table: "tasks",
                values: {
                    pr_number: 7,
                    pr_state: "closed",
                    pr_url: "https://github.com/acme/repo/pull/7",
                },
            },
        ]);
    });

    it("keeps searching later projects after a branch collision", async () => {
        const { client, state } = createMock([
            {
                github_full_name: "acme/repo",
                id: "project-a",
                table: "projects",
            },
            {
                github_full_name: "acme/repo",
                id: "project-b",
                table: "projects",
            },
            task({
                branch_name: "feature/TASK-1-login",
                id: "unbound",
                pr_number: null,
                project_id: "project-a",
                task_key: "TASK-1",
            }),
            task({
                branch_name: "feature/TASK-9-api",
                id: "bound",
                pr_number: 7,
                pr_state: "open",
                project_id: "project-b",
                task_key: "TASK-9",
            }),
        ]);

        const result = await syncClosedPullRequest(
            client,
            {
                action: "closed",
                pull_request: {
                    head: { ref: "feature/TASK-1-login" },
                    html_url: "https://github.com/acme/repo/pull/7",
                    merged: false,
                    number: 7,
                },
                repository: { full_name: "acme/repo" },
            },
            log
        );

        expect(result).toMatchObject({ skipped: false, taskId: "bound" });
        expect(state.updates.map((update) => update.id)).toEqual(["bound"]);
    });
});

describe("syncMergedPullRequest task matching", () => {
    it("moves the linked task to the last column when it sits past the row cap", async () => {
        const filler = Array.from({ length: MAX_ROWS }, (_, index) =>
            task({
                id: `t${String(index).padStart(4, "0")}`,
                task_key: `OTHER-${index}`,
            })
        );
        const linked = task({
            branch_name: "feature/TASK-1-login",
            id: "z-linked",
            pr_number: 7,
            pr_state: "open",
            task_key: "TASK-1",
        });
        const { client, state } = createMock([
            {
                github_full_name: "acme/repo",
                id: "project-1",
                table: "projects",
            },
            { base_branch: "main", id: "board-1", table: "boards" },
            {
                board_id: "board-1",
                id: "todo",
                name: "To Do",
                position: 0,
                table: "board_columns",
            },
            {
                board_id: "board-1",
                id: "done",
                name: "Done",
                position: 3,
                table: "board_columns",
            },
            ...filler,
            linked,
        ]);

        const result = await syncMergedPullRequest(
            client,
            {
                action: "closed",
                pull_request: {
                    base: { ref: "main" },
                    head: { ref: "feature/TASK-1-login" },
                    html_url: "https://github.com/acme/repo/pull/7",
                    merged: true,
                    number: 7,
                },
                repository: { full_name: "acme/repo" },
            },
            log
        );

        expect(result).toMatchObject({
            skipped: false,
            status: "done",
            taskId: "z-linked",
        });
        expect(state.updates).toEqual([
            expect.objectContaining({
                id: "z-linked",
                table: "tasks",
                values: expect.objectContaining({
                    pr_number: 7,
                    pr_state: "merged",
                    status: "done",
                }),
            }),
        ]);
    });
});
