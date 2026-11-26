import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
let token: null | string = "gho_token";

vi.mock("@/shared/api/supabase", () => ({
    supabase: { functions: { invoke } },
}));
vi.mock("@/features/auth/model/github-token", () => ({
    getGitHubAccessToken: () => token,
}));

const {
    GitHubRepositoryAccessError,
    githubRepositoryAccessReason,
    verifyGitHubRepositories,
} = await import("./verify-github-repositories-api");

const WEB = { github_full_name: "acme/web", github_repo_id: 1 };
const API = { github_full_name: "acme/api", github_repo_id: 2 };

describe("verifyGitHubRepositories", () => {
    beforeEach(() => {
        invoke.mockReset();
        token = "gho_token";
    });

    it("sends the user's GitHub token and resolves when every repository is verified", async () => {
        invoke.mockResolvedValue({
            data: {
                repositories: [
                    { id: 1, status: "verified" },
                    { id: 2, status: "verified" },
                ],
            },
            error: null,
        });

        await expect(verifyGitHubRepositories([WEB, API])).resolves.toBe(
            undefined
        );
        expect(invoke).toHaveBeenCalledWith("verify-github-repositories", {
            body: {
                githubToken: "gho_token",
                repositories: [
                    { fullName: "acme/web", id: 1 },
                    { fullName: "acme/api", id: 2 },
                ],
            },
        });
    });

    it("names the repositories GitHub did not confirm", async () => {
        invoke.mockResolvedValue({
            data: {
                repositories: [
                    { id: 1, status: "verified" },
                    { id: 2, status: "no_access" },
                ],
            },
            error: null,
        });

        const error = await verifyGitHubRepositories([WEB, API]).catch(
            (error_: unknown) => error_
        );

        expect(error).toBeInstanceOf(GitHubRepositoryAccessError);
        expect(error).toMatchObject({
            reason: "no_access",
            repositories: ["acme/api"],
        });
    });

    it("reports a failed call as unavailable", async () => {
        invoke.mockResolvedValue({ data: null, error: new Error("down") });

        await expect(verifyGitHubRepositories([WEB])).rejects.toMatchObject({
            reason: "unavailable",
        });
    });

    it("refuses without a GitHub token and skips the call", async () => {
        token = null;

        await expect(verifyGitHubRepositories([WEB])).rejects.toMatchObject({
            reason: "no_access",
        });
        expect(invoke).not.toHaveBeenCalled();
    });

    it("does nothing for a name-only Project", async () => {
        await verifyGitHubRepositories([]);
        expect(invoke).not.toHaveBeenCalled();
    });
});

describe("githubRepositoryAccessReason", () => {
    it("reads the Edge Function error and Postgres' refusal alike", () => {
        expect(
            githubRepositoryAccessReason(
                new GitHubRepositoryAccessError("unavailable", ["acme/web"])
            )
        ).toBe("unavailable");
        expect(
            githubRepositoryAccessReason({
                code: "42501",
                hint: "github_repository_unverified",
            })
        ).toBe("no_access");
        expect(githubRepositoryAccessReason(new Error("other"))).toBeNull();
    });
});
