import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
    createFakeSupabase,
    type Tables,
} from "../github-webhook/fake-supabase.test-helper";
import { createGithubBackfillHandler } from "./handler";

const APP_ORIGIN = "https://plotops.webrunner.dev";
const PROJECT_ID = "6f1c2c1e-6d0b-4a8e-9a57-6c5d1c7c1a11";

const PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ format: "pem", type: "pkcs1" })
    .toString();

const REPOSITORY = {
    github_full_name: "acme/web",
    github_repo_id: 101,
    id: "repo-web",
    project_id: "project-1",
};

const reply = (body: unknown, status = 200) => Response.json(body, { status });

/** GitHub: App installed on acme/web, two open PRs, three branches. */
function github(options: { installed?: boolean } = {}) {
    return vi.fn(async (url: string) => {
        if (url.endsWith("/repos/acme/web/installation")) {
            return options.installed === false
                ? reply({}, 404)
                : reply({ id: 77 });
        }
        if (url.endsWith("/app/installations/77/access_tokens")) {
            return reply({ token: "ghs_x" }, 201);
        }
        if (url.includes("/repos/acme/web/pulls?")) {
            return reply([
                {
                    body: null,
                    head: { ref: "fix-login" },
                    html_url: "https://github.com/acme/web/pull/11",
                    number: 11,
                    title: "TASK-1: Fix login",
                },
                {
                    body: "",
                    head: { ref: "TASK-3-old" },
                    html_url: "https://github.com/acme/web/pull/12",
                    number: 12,
                    title: "Unlinked by hand",
                },
            ]);
        }
        if (url.includes("/repos/acme/web/branches?")) {
            return reply([
                { name: "main" },
                { name: "fix-login" },
                { name: "TASK-2-api" },
            ]);
        }
        return reply({}, 404);
    }) as unknown as typeof fetch;
}

function request(body?: unknown): Request {
    return new Request("https://edge.test/github-backfill", {
        body: JSON.stringify(body ?? { projectId: PROJECT_ID }),
        headers: {
            Authorization: "Bearer jwt",
            "Content-Type": "application/json",
            Origin: APP_ORIGIN,
        },
        method: "POST",
    });
}

function seed(): Tables {
    return {
        activity_log: [],
        project_repositories: [
            { github_repo_id: 101, id: "repo-web", project_id: "project-1" },
        ],
        task_git_link_dismissals: [
            {
                kind: "pr",
                repository_id: "repo-web",
                task_id: "t3",
                value: "12",
            },
        ],
        task_git_links: [],
        tasks: [
            { id: "t1", key: 1, project_id: "project-1", task_key: "TASK-1" },
            { id: "t2", key: 2, project_id: "project-1", task_key: "TASK-2" },
            { id: "t3", key: 3, project_id: "project-1", task_key: "TASK-3" },
        ].map((row) => ({
            archived_at: null,
            board_id: "board-1",
            parent_id: null,
            status: "todo",
            ...row,
        })),
    };
}

function setup(
    options: {
        canEdit?: boolean;
        env?: Record<string, string>;
        fetchImpl?: typeof fetch;
    } = {}
) {
    const tables = seed();
    const service = createFakeSupabase(tables);
    const handler = createGithubBackfillHandler({
        cors: {
            allowedOrigins: [APP_ORIGIN],
            allowHeaders: "authorization, content-type",
        },
        createServiceClient: () => service.client,
        createUserClient: () => userClient({ canEdit: options.canEdit }),
        env: (name) =>
            (options.env ?? {
                GITHUB_APP_ID: "123",
                GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY,
            })[name],
        fetchImpl: options.fetchImpl ?? github(),
        nowSec: () => 1_000_000,
        rateLimiter: { check: async () => ({ allowed: true }) },
    });
    return { handler, tables };
}

function userClient(options: { canEdit?: boolean } = {}) {
    const query = {
        eq: vi.fn(() => query),
        // eslint-disable-next-line unicorn/no-thenable -- PostgREST builders are awaited
        then: (resolve: (value: unknown) => unknown) =>
            resolve({ data: [REPOSITORY], error: null }),
    };
    return {
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: "user-1" } },
                error: null,
            })),
        },
        from: vi.fn(() => ({ select: () => query })),
        rpc: vi.fn(async () => ({
            data: options.canEdit ?? true,
            error: null,
        })),
    } as unknown as SupabaseClient;
}

const linkOf = (tables: Tables, taskId: string) =>
    tables.task_git_links.find((row) => row.task_id === taskId);

describe("github-backfill handler", () => {
    it("links open PRs and branches that carry a task key", async () => {
        const { handler, tables } = setup();
        const response = await handler(request());

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            configured: true,
            linked: 2,
            repositories: [{ id: "repo-web", status: "synced" }],
        });
        expect(linkOf(tables, "t1")).toMatchObject({
            branch_name: "fix-login",
            pr_number: 11,
            pr_state: "open",
        });
        expect(linkOf(tables, "t2")).toMatchObject({
            branch_name: "TASK-2-api",
            pr_number: null,
        });
        // TASK-3's PR was unlinked by hand: not brought back.
        expect(linkOf(tables, "t3")).toBeUndefined();
        expect(
            tables.activity_log.map(
                (row) => (row.metadata as { auto_link?: unknown }).auto_link
            )
        ).toEqual([{ key: "TASK-1" }, { key: "TASK-2" }]);
    });

    it("is idempotent", async () => {
        const { handler, tables } = setup();
        await handler(request());
        const second = await handler(request());

        expect(await second.json()).toMatchObject({ linked: 0 });
        expect(tables.activity_log).toHaveLength(2);
    });

    it("reports a Repository without the App as not installed", async () => {
        const { handler, tables } = setup({
            fetchImpl: github({ installed: false }),
        });
        const response = await handler(request());

        expect(await response.json()).toMatchObject({
            linked: 0,
            repositories: [{ id: "repo-web", status: "not_installed" }],
        });
        expect(tables.task_git_links).toEqual([]);
    });

    it("answers configured: false without App credentials", async () => {
        const fetchImpl = vi.fn() as unknown as typeof fetch;
        const { handler } = setup({ env: {}, fetchImpl });
        const response = await handler(request());

        expect(await response.json()).toMatchObject({
            configured: false,
            linked: 0,
        });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("refuses callers who cannot edit Tasks", async () => {
        const fetchImpl = vi.fn() as unknown as typeof fetch;
        const { handler } = setup({ canEdit: false, fetchImpl });
        const response = await handler(request());

        expect(response.status).toBe(403);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects a request without a bearer token or with a bad body", async () => {
        const { handler } = setup();
        const anonymous = new Request("https://edge.test/github-backfill", {
            body: "{}",
            method: "POST",
        });

        const unauthorized = await handler(anonymous);
        const invalid = await handler(request({ projectId: "x" }));

        expect(unauthorized.status).toBe(401);
        expect(invalid.status).toBe(400);
    });
});
