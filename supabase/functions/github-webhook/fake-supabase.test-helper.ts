import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

/**
 * In-memory stand-in for the PostgREST calls sync.ts makes: select / eq /
 * order / limit / maybeSingle, the embedded `task_git_links (...)` select,
 * insert, update, upsert on `task_id,repository_id`, and rpc.
 */
export function createFakeSupabase(tables: Tables) {
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
                    table.push({
                        branch_name: null,
                        pr_number: null,
                        pr_state: null,
                        pr_url: null,
                        ...this.payload,
                    });
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
