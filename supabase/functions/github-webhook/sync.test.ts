import { beforeEach, describe, expect, it } from "vitest";

import {
    createFakeSupabase,
    type Row,
    type Tables,
} from "./fake-supabase.test-helper";
import {
    syncClosedPullRequest,
    syncCreatedBranch,
    syncMergedPullRequest,
    syncOpenedPullRequest,
} from "./sync";

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

/** `create` webhook payload for a pushed branch. */
const created = (repo: typeof WEB, branchName: string) => ({
    ref: branchName,
    ref_type: "branch",
    repository: { full_name: repo.name, id: repo.github },
});

/** `pull_request` opened payload with a title and body. */
const opened = (
    repo: typeof WEB,
    pr: {
        body?: null | string;
        head: string;
        number: number;
        title: string;
    }
) => {
    const base = payload(repo, pr, "opened");
    return {
        ...base,
        pull_request: {
            ...base.pull_request,
            body: pr.body,
            title: pr.title,
        },
    };
};

describe("github-webhook auto-link by task key (#351)", () => {
    let tables: Tables;
    let fake: ReturnType<typeof createFakeSupabase>;
    const logs: Row[] = [];
    const log = (fields: Row) => logs.push(fields);

    const dismiss = (taskId: string, kind: "branch" | "pr", value: string) =>
        (tables.task_git_link_dismissals ??= []).push({
            kind,
            project_id: "project-1",
            repository_id: WEB.id,
            task_id: taskId,
            value,
        });

    beforeEach(() => {
        tables = seed();
        fake = createFakeSupabase(tables);
        logs.length = 0;
    });

    it("links a pushed branch TASK-1-login without a PR to TASK-1", async () => {
        addTask(tables, "t1", "TASK-1");

        const result = await syncCreatedBranch(
            fake.client,
            created(WEB, "TASK-1-login"),
            log
        );

        expect(result).toMatchObject({ skipped: false, taskId: "t1" });
        expect(link(tables, "t1", WEB)).toMatchObject({
            branch_name: "TASK-1-login",
            pr_number: null,
        });
        expect(tables.activity_log).toEqual([
            expect.objectContaining({
                metadata: {
                    auto_link: { key: "TASK-1" },
                    changes: [
                        { field: "branch", from: null, to: "TASK-1-login" },
                    ],
                    source: "github_webhook",
                },
                task_id: "t1",
                user_id: null,
            }),
        ]);

        // The PR opened from it later joins that Git link (bind).
        await syncOpenedPullRequest(
            fake.client,
            opened(WEB, { head: "TASK-1-login", number: 4, title: "Login" }),
            log
        );
        expect(link(tables, "t1", WEB)).toMatchObject({
            branch_name: "TASK-1-login",
            pr_number: 4,
            pr_state: "open",
        });
    });

    it("ignores tags, branches without a key and already linked branches", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { branch_name: "TASK-1-login" });

        expect(
            await syncCreatedBranch(
                fake.client,
                { ...created(WEB, "TASK-1"), ref_type: "tag" },
                log
            )
        ).toMatchObject({ reason: "not_branch_create", skipped: true });
        expect(
            await syncCreatedBranch(fake.client, created(WEB, "main"), log)
        ).toMatchObject({ reason: "no_task", skipped: true });
        expect(
            await syncCreatedBranch(
                fake.client,
                created(WEB, "TASK-1-login"),
                log
            )
        ).toMatchObject({ reason: "already_linked", skipped: true });
        expect(tables.activity_log).toEqual([]);
    });

    it("links a PR titled TASK-1: Fix login from a branch without a key", async () => {
        addTask(tables, "t1", "TASK-1");

        const result = await syncOpenedPullRequest(
            fake.client,
            opened(WEB, {
                head: "fix-login",
                number: 8,
                title: "TASK-1: Fix login",
            }),
            log
        );

        expect(result).toMatchObject({ skipped: false, taskId: "t1" });
        expect(link(tables, "t1", WEB)).toMatchObject({
            branch_name: "fix-login",
            pr_number: 8,
            pr_state: "open",
        });
        expect(tables.activity_log[0]?.metadata).toMatchObject({
            auto_link: { key: "TASK-1" },
        });
    });

    it("links one PR to every Task its title and body name", async () => {
        addTask(tables, "t1", "TASK-1");
        addTask(tables, "t2", "TASK-2");
        addTask(tables, "t3", "TASK-3");
        addLink(tables, "t3", WEB, { pr_number: 2, pr_state: "open" });

        const result = await syncOpenedPullRequest(
            fake.client,
            opened(WEB, {
                body: "Closes task-2 and TASK-3.",
                head: "shared-login",
                number: 8,
                title: "TASK-1: Fix login",
            }),
            log
        );

        expect(result).toMatchObject({
            skipped: false,
            taskIds: ["t1", "t2"],
        });
        expect(link(tables, "t1", WEB)).toMatchObject({ pr_number: 8 });
        expect(link(tables, "t2", WEB)).toMatchObject({ pr_number: 8 });
        // TASK-3 already holds another PR — never overwritten.
        expect(link(tables, "t3", WEB)).toMatchObject({ pr_number: 2 });
        expect(logs).toContainEqual(
            expect.objectContaining({
                linkedPr: 2,
                pr: 8,
                reason: "link_conflict",
                taskId: "t3",
            })
        );
    });

    it("moves every linked Task when the shared PR merges", async () => {
        addTask(tables, "t1", "TASK-1");
        addTask(tables, "t2", "TASK-2");
        addLink(tables, "t1", WEB, { pr_number: 8, pr_state: "open" });
        addLink(tables, "t2", WEB, { pr_number: 8, pr_state: "open" });

        await syncMergedPullRequest(
            fake.client,
            payload(WEB, { head: "shared-login", number: 8 }),
            log
        );

        expect(status(tables, "t1")).toBe("done");
        expect(status(tables, "t2")).toBe("done");
    });

    it("does not relink a PR after a manual unlink", async () => {
        addTask(tables, "t1", "TASK-1");
        // The person unlinked PR #8 (the DB trigger remembered it).
        dismiss("t1", "pr", "8");

        const event = opened(WEB, {
            head: "feature/TASK-1-login",
            number: 8,
            title: "TASK-1: Fix login",
        });
        const result = await syncOpenedPullRequest(fake.client, event, log);

        expect(result).toMatchObject({ reason: "dismissed", skipped: true });
        expect(link(tables, "t1", WEB)).toBeUndefined();

        // Neither does its merge.
        expect(
            await syncMergedPullRequest(
                fake.client,
                payload(WEB, { head: "feature/TASK-1-login", number: 8 }),
                log
            )
        ).toMatchObject({ reason: "dismissed", skipped: true });
        expect(link(tables, "t1", WEB)).toBeUndefined();
        expect(status(tables, "t1")).toBe("review");
        expect(tables.activity_log).toEqual([]);
    });

    it("does not bind a dismissed PR to a still-linked branch", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { branch_name: "feature/TASK-1-login" });
        dismiss("t1", "pr", "8");

        expect(
            await syncOpenedPullRequest(
                fake.client,
                opened(WEB, {
                    head: "feature/TASK-1-login",
                    number: 8,
                    title: "Login",
                }),
                log
            )
        ).toMatchObject({ reason: "dismissed", skipped: true });
        expect(link(tables, "t1", WEB)).toMatchObject({ pr_number: null });
    });

    it("does not relink a branch after a manual unlink", async () => {
        addTask(tables, "t1", "TASK-1");
        dismiss("t1", "branch", "TASK-1-login");

        expect(
            await syncCreatedBranch(
                fake.client,
                created(WEB, "TASK-1-login"),
                log
            )
        ).toMatchObject({ reason: "dismissed", skipped: true });
        expect(link(tables, "t1", WEB)).toBeUndefined();
    });

    it("never overwrites an existing Git link from a pushed branch", async () => {
        addTask(tables, "t1", "TASK-1");
        addLink(tables, "t1", WEB, { branch_name: "feature/TASK-1-old" });

        expect(
            await syncCreatedBranch(
                fake.client,
                created(WEB, "TASK-1-new"),
                log
            )
        ).toMatchObject({ reason: "link_conflict", skipped: true });
        expect(link(tables, "t1", WEB)).toMatchObject({
            branch_name: "feature/TASK-1-old",
        });
        expect(logs).toContainEqual(
            expect.objectContaining({
                linkedBranch: "feature/TASK-1-old",
                reason: "link_conflict",
                ref: "TASK-1-new",
                taskId: "t1",
            })
        );
    });

    it("limits a run to one Repository when asked (backfill)", async () => {
        addTask(tables, "t1", "TASK-1");
        // Another Team links the same GitHub repository.
        tables.project_repositories.push({
            github_repo_id: WEB.github,
            id: "repo-web-other",
            project_id: "project-2",
        });

        await syncCreatedBranch(
            fake.client,
            created(WEB, "TASK-1-login"),
            log,
            {
                repository: { id: "repo-web-other", project_id: "project-2" },
            }
        );

        expect(link(tables, "t1", WEB)).toBeUndefined();
    });
});
