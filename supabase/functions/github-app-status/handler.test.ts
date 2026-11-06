import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { RateLimiter } from "../_shared/postgres-rate-limit";

import { createGithubAppStatusHandler } from "./handler";

const APP_ORIGIN = "https://plotops.webrunner.dev";
const PROJECT_ID = "6f1c2c1e-6d0b-4a8e-9a57-6c5d1c7c1a11";

const PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ format: "pem", type: "pkcs1" })
    .toString();

const ROWS = [
    { github_full_name: "acme/web", id: "repo-web" },
    { github_full_name: "acme/api", id: "repo-api" },
];

function fakeSupabase(rows = ROWS) {
    const eq = vi.fn(async () => ({ data: rows, error: null }));
    return {
        client: {
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: "user-1" } },
                    error: null,
                })),
            },
            from: vi.fn(() => ({ select: () => ({ eq }) })),
        } as unknown as SupabaseClient,
        eq,
    };
}

function request(body?: unknown): Request {
    return new Request("https://edge.test/github-app-status", {
        body: JSON.stringify(body ?? { projectId: PROJECT_ID }),
        headers: {
            Authorization: "Bearer jwt",
            "Content-Type": "application/json",
            Origin: APP_ORIGIN,
        },
        method: "POST",
    });
}

function setup(
    options: {
        env?: Record<string, string>;
        fetchImpl?: typeof fetch;
        rateLimiter?: RateLimiter;
    } = {}
) {
    const supabase = fakeSupabase();
    const handler = createGithubAppStatusHandler({
        cors: {
            allowedOrigins: [APP_ORIGIN],
            allowHeaders: "authorization, content-type",
        },
        createUserClient: () => supabase.client,
        env: (name) => options.env?.[name],
        fetchImpl: options.fetchImpl,
        nowSec: () => 1_000_000,
        rateLimiter: options.rateLimiter ?? {
            check: async () => ({ allowed: true }),
        },
    });
    return { handler, supabase };
}

describe("github-app-status handler", () => {
    it("reports each Repository's App installation through the caller's RLS", async () => {
        const fetchImpl = vi.fn(async (url: string) =>
            url.endsWith("/app") || url.includes("/acme/web/")
                ? new Response("{}", { status: 200 })
                : new Response("{}", { status: 404 })
        ) as unknown as typeof fetch;
        const { handler, supabase } = setup({
            env: {
                GITHUB_APP_ID: "42",
                GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY,
                GITHUB_APP_SLUG: "plotops-sync",
            },
            fetchImpl,
        });

        const response = await handler(request());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            configured: true,
            installUrl:
                "https://github.com/apps/plotops-sync/installations/new",
            repositories: [
                { id: "repo-web", status: "installed" },
                { id: "repo-api", status: "not_installed" },
            ],
        });
        expect(supabase.eq).toHaveBeenCalledWith("project_id", PROJECT_ID);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
            APP_ORIGIN
        );
    });

    it("falls back to GET /app for the install link when no slug is set", async () => {
        const fetchImpl = vi.fn(async (url: string) =>
            url.endsWith("/app")
                ? Response.json({ slug: "from-api" })
                : new Response("{}", { status: 200 })
        ) as unknown as typeof fetch;
        const { handler } = setup({
            env: { GITHUB_APP_ID: "42", GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY },
            fetchImpl,
        });

        const response = await handler(request());
        const body = (await response.json()) as { installUrl: string };

        expect(body.installUrl).toBe(
            "https://github.com/apps/from-api/installations/new"
        );
    });

    it("answers unknown for every Repository when GitHub rejects the App JWT", async () => {
        // GitHub answers 404 on both endpoints for a bad JWT — without the
        // GET /app check every Repository would read as not installed.
        const fetchImpl = vi.fn(
            async () => new Response("{}", { status: 404 })
        ) as unknown as typeof fetch;
        const { handler } = setup({
            env: { GITHUB_APP_ID: "42", GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY },
            fetchImpl,
        });

        const response = await handler(request());

        await expect(response.json()).resolves.toEqual({
            configured: true,
            installUrl: null,
            repositories: [
                { id: "repo-web", status: "unknown" },
                { id: "repo-api", status: "unknown" },
            ],
        });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("answers unknown for every Repository when the App is not configured", async () => {
        const fetchImpl = vi.fn() as unknown as typeof fetch;
        const { handler } = setup({ fetchImpl });

        const response = await handler(request());

        await expect(response.json()).resolves.toEqual({
            configured: false,
            installUrl: null,
            repositories: [
                { id: "repo-web", status: "unknown" },
                { id: "repo-api", status: "unknown" },
            ],
        });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects a missing bearer, a bad body and rate-limited callers", async () => {
        const { handler } = setup({
            rateLimiter: {
                check: async () => ({ allowed: false, retryAfterSec: 30 }),
            },
        });

        const noAuth = new Request("https://edge.test/github-app-status", {
            body: "{}",
            method: "POST",
        });
        const unauthorized = await handler(noAuth);
        const invalid = await handler(request({ projectId: "nope" }));
        const limited = await handler(request());

        expect(unauthorized.status).toBe(401);
        expect(invalid.status).toBe(400);
        expect(limited.status).toBe(429);
    });
});
