import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../_shared/database-client.ts";
import type { RateLimiter } from "../_shared/postgres-rate-limit";

import { createVerifyGithubRepositoriesHandler } from "./handler";

const APP_ORIGIN = "https://plotops.webrunner.dev";
const TOKEN = "gho_callertoken";

type GithubRepo = {
    default_branch?: string;
    full_name: string;
    html_url: string;
    id: number;
    permissions?: { admin?: boolean; maintain?: boolean; push?: boolean };
    private: boolean;
};

const PRIVATE_REPO: GithubRepo = {
    default_branch: "trunk",
    full_name: "acme/web",
    html_url: "https://github.com/acme/web",
    id: 101,
    permissions: { admin: false, maintain: false, push: false },
    private: true,
};

/** GitHub fake: `repos` keyed by `owner/name` as the caller's token sees them. */
function githubFetch(
    repos: Record<string, GithubRepo | number>
): typeof fetch & { mock: { calls: unknown[][] } } {
    return vi.fn(async (url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        if (headers.Authorization !== `Bearer ${TOKEN}`) {
            return new Response("{}", { status: 401 });
        }
        const fullName = decodeURIComponent(
            url.replace("https://api.github.com/repos/", "")
        );
        const repo = repos[fullName];
        if (repo === undefined) return new Response("{}", { status: 404 });
        if (typeof repo === "number") {
            return new Response("{}", { status: repo });
        }
        return Response.json(repo);
    }) as unknown as typeof fetch & { mock: { calls: unknown[][] } };
}

function publicRepo(permissions: GithubRepo["permissions"]): GithubRepo {
    return { ...PRIVATE_REPO, permissions, private: false };
}

function request(body: unknown, authorization = "Bearer jwt"): Request {
    return new Request("https://edge.test/verify-github-repositories", {
        body: JSON.stringify(body),
        headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            Origin: APP_ORIGIN,
        },
        method: "POST",
    });
}

function setup(
    options: {
        fetchImpl?: typeof fetch;
        rateLimiter?: RateLimiter;
        upsertError?: { message: string };
        user?: null | { id: string };
    } = {}
) {
    const upsert = vi.fn(async () => ({
        error: options.upsertError ?? null,
    }));
    const from = vi.fn(() => ({ upsert }));
    const userClient = {
        auth: {
            getUser: vi.fn(async () => ({
                data: {
                    user:
                        options.user === undefined
                            ? { id: "user-1" }
                            : options.user,
                },
                error: null,
            })),
        },
    } as unknown as DatabaseClient;
    const serviceClient = { from } as unknown as DatabaseClient;

    const handler = createVerifyGithubRepositoriesHandler({
        cors: {
            allowedOrigins: [APP_ORIGIN],
            allowHeaders: "authorization, content-type",
        },
        createServiceClient: () => serviceClient,
        createUserClient: () => userClient,
        fetchImpl: options.fetchImpl ?? githubFetch({}),
        rateLimiter: options.rateLimiter ?? {
            check: async () => ({ allowed: true }),
        },
    });
    return { from, handler, upsert };
}

describe("verify-github-repositories handler", () => {
    it("records what GitHub reports for a private repository the caller can see", async () => {
        const fetchImpl = githubFetch({ "acme/web": PRIVATE_REPO });
        const { from, handler, upsert } = setup({ fetchImpl });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [{ fullName: "acme/web", id: 101 }],
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            repositories: [{ id: 101, status: "verified" }],
        });
        expect(from).toHaveBeenCalledWith("github_repository_verifications");
        expect(upsert).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    github_default_branch: "trunk",
                    github_full_name: "acme/web",
                    github_html_url: "https://github.com/acme/web",
                    github_repo_id: 101,
                    is_private: true,
                    user_id: "user-1",
                }),
            ],
            { onConflict: "user_id,github_repo_id" }
        );
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
            APP_ORIGIN
        );
    });

    it("refuses a repository the caller's token cannot see", async () => {
        const { handler, upsert } = setup({ fetchImpl: githubFetch({}) });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [{ fullName: "victim/secret", id: 999 }],
            })
        );

        await expect(response.json()).resolves.toEqual({
            repositories: [{ id: 999, status: "no_access" }],
        });
        expect(upsert).not.toHaveBeenCalled();
    });

    it("refuses a known name sent with another repository's id", async () => {
        const { handler, upsert } = setup({
            fetchImpl: githubFetch({ "acme/web": PRIVATE_REPO }),
        });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [{ fullName: "acme/web", id: 999 }],
            })
        );

        await expect(response.json()).resolves.toEqual({
            repositories: [{ id: 999, status: "no_access" }],
        });
        expect(upsert).not.toHaveBeenCalled();
    });

    it("needs write access to a public repository, since anyone can read it", async () => {
        const { handler, upsert } = setup({
            fetchImpl: githubFetch({
                "acme/read": { ...publicRepo({ push: false }), id: 1 },
                "acme/write": { ...publicRepo({ push: true }), id: 2 },
            }),
        });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [
                    { fullName: "acme/read", id: 1 },
                    { fullName: "acme/write", id: 2 },
                ],
            })
        );

        await expect(response.json()).resolves.toEqual({
            repositories: [
                { id: 1, status: "no_access" },
                { id: 2, status: "verified" },
            ],
        });
        expect(upsert).toHaveBeenCalledWith(
            [expect.objectContaining({ github_repo_id: 2 })],
            expect.anything()
        );
    });

    it("reports a GitHub outage as unavailable, not as no access", async () => {
        const { handler } = setup({
            fetchImpl: githubFetch({ "acme/web": 502 }),
        });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [{ fullName: "acme/web", id: 101 }],
            })
        );

        await expect(response.json()).resolves.toEqual({
            repositories: [{ id: 101, status: "unavailable" }],
        });
    });

    it("answers 500 when the verification cannot be stored", async () => {
        const { handler } = setup({
            fetchImpl: githubFetch({ "acme/web": PRIVATE_REPO }),
            upsertError: { message: "boom" },
        });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [{ fullName: "acme/web", id: 101 }],
            })
        );

        expect(response.status).toBe(500);
    });

    it("rejects a caller without a session", async () => {
        const { handler } = setup({ user: null });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [{ fullName: "acme/web", id: 101 }],
            })
        );

        expect(response.status).toBe(401);
    });

    it("rejects a malformed body before calling GitHub", async () => {
        const fetchImpl = githubFetch({});
        const { handler } = setup({ fetchImpl });

        for (const body of [
            { githubToken: TOKEN, repositories: [] },
            {
                githubToken: TOKEN,
                repositories: [{ fullName: "../../user", id: 1 }],
            },
            {
                githubToken: TOKEN,
                repositories: Array.from({ length: 6 }, (_, index) => ({
                    fullName: `acme/r${index}`,
                    id: index + 1,
                })),
            },
            { repositories: [{ fullName: "acme/web", id: 101 }] },
        ]) {
            const response = await handler(request(body));
            expect(response.status).toBe(400);
        }
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("answers 429 when the caller is over the limit", async () => {
        const { handler } = setup({
            rateLimiter: {
                check: async () => ({ allowed: false, retryAfterSec: 30 }),
            },
        });

        const response = await handler(
            request({
                githubToken: TOKEN,
                repositories: [{ fullName: "acme/web", id: 101 }],
            })
        );

        expect(response.status).toBe(429);
    });
});
