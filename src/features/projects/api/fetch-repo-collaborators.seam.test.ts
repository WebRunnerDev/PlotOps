import { afterEach, describe, expect, it, vi } from "vitest";

import {
    fetchRepoCollaborators,
    GitHubApiError,
} from "@/features/projects/api/github-api";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetchRepoCollaborators", () => {
    it("maps collaborator payload and enrich from public user email when missing", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/collaborators")) {
                return {
                    json: async () => [
                        {
                            avatar_url: "https://example.com/alice.png",
                            email: "alice@example.com",
                            id: 11,
                            login: "alice",
                        },
                        {
                            avatar_url: "https://example.com/bob.png",
                            id: 22,
                            login: "bob",
                        },
                    ],
                    ok: true,
                };
            }
            if (url.endsWith("/users/bob")) {
                return {
                    json: async () => ({ email: "bob@example.com" }),
                    ok: true,
                };
            }
            return {
                json: async () => ({}),
                ok: true,
            };
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchRepoCollaborators("acme", "widgets", "tok");

        expect(result).toEqual([
            {
                avatarUrl: "https://example.com/alice.png",
                email: "alice@example.com",
                id: 11,
                login: "alice",
            },
            {
                avatarUrl: "https://example.com/bob.png",
                email: "bob@example.com",
                id: 22,
                login: "bob",
            },
        ]);
        expect(
            fetchMock.mock.calls.some((call) =>
                String(call[0]).includes("/repos/acme/widgets/collaborators")
            )
        ).toBe(true);
        expect(
            fetchMock.mock.calls.some((call) =>
                String(call[0]).endsWith("/users/bob")
            )
        ).toBe(true);
        expect(
            fetchMock.mock.calls.some((call) =>
                String(call[0]).endsWith("/users/alice")
            )
        ).toBe(false);
    });

    it("throws GitHubApiError when the request fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: false,
                status: 403,
                statusText: "Forbidden",
            }))
        );

        await expect(
            fetchRepoCollaborators("acme", "widgets", "tok")
        ).rejects.toBeInstanceOf(GitHubApiError);
    });
});
