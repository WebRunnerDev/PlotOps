import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRepositoryInput } from "@/features/projects/model/types";

import { resolveProjectsProvider } from "@/features/projects/api/resolve-projects-provider";
import { PROJECT_REPOSITORIES_CAP } from "@/features/projects/model/limits";

function repo(
    id: number,
    name: string,
    branch = "main"
): ProjectRepositoryInput {
    return {
        github_default_branch: branch,
        github_full_name: `plotops-demo/${name}`,
        github_html_url: `https://github.com/plotops-demo/${name}`,
        github_repo_id: id,
    };
}

async function startGuest() {
    const guestMode = await import("@/features/guest-mode");
    guestMode.startGuestSession();
    const sandbox = guestMode.getGuestSandbox()!;
    return {
        guestMode,
        provider: resolveProjectsProvider(true),
        teamId: sandbox.teams[0]!.id,
    };
}

function stubSessionStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    });
}

beforeEach(() => {
    stubSessionStorage();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("guest Projects with several Repositories (ADR 0035)", () => {
    it("serves «Web + API» with both Repositories, oldest first", async () => {
        const { guestMode, provider } = await startGuest();

        const { data } = await provider.fetchProject(
            guestMode.GUEST_DEMO_PROJECT_ID
        );

        expect(data?.name).toBe("Web + API");
        expect(data?.repositories.map((r) => r.github_full_name)).toEqual([
            "plotops-demo/web",
            "plotops-demo/api",
        ]);
        expect(data?.github_full_name).toBe("plotops-demo/web");
    });

    it("creates a Project with more Repositories than the cap and a seeded Development Board", async () => {
        const { guestMode, provider, teamId } = await startGuest();
        const repositories = [
            repo(1, "a"),
            repo(2, "b", "develop"),
            repo(3, "c"),
            repo(4, "d"),
            repo(5, "e"),
            repo(6, "f"),
        ];
        expect(repositories.length).toBeGreaterThan(PROJECT_REPOSITORIES_CAP);

        const { data, error } = await provider.createProject({
            description: null,
            is_private: false,
            name: "Monorepo split",
            repositories,
            slug: "monorepo-split",
            team_id: teamId,
        });

        expect(error).toBeNull();
        expect(data?.repositories).toHaveLength(6);
        const boards = guestMode
            .getGuestSandbox()!
            .boards.filter((board) => board.projectId === data!.id);
        expect(boards).toHaveLength(1);
        expect(boards[0]!.isDevelopment).toBe(true);
        expect(
            boards[0]!.repositoryBaseBranches.map((entry) => entry.baseBranch)
        ).toEqual(["main", "develop", "main", "main", "main", "main"]);
    });

    it("rejects a repository already linked in the Team as a unique violation", async () => {
        const { provider, teamId } = await startGuest();

        const { error } = await provider.createProject({
            description: null,
            is_private: false,
            name: "Dup",
            repositories: [repo(999_000_002, "api", "develop")],
            slug: "dup",
            team_id: teamId,
        });

        expect(error).toMatchObject({ code: "23505" });
    });

    it("links a Repository and seeds its Base branch on every Development Board", async () => {
        const { guestMode, provider } = await startGuest();
        const projectId = guestMode.GUEST_DEMO_PROJECT_ID;

        const { data } = await provider.addProjectRepository(projectId, {
            ...repo(999_000_003, "mobile", "trunk"),
            is_private: false,
        });

        expect(data?.repositories).toHaveLength(3);
        const added = data!.repositories[2]!;
        const board = guestMode
            .getGuestSandbox()!
            .boards.find((item) => item.id === guestMode.GUEST_DEMO_BOARD_ID)!;
        expect(board.repositoryBaseBranches).toContainEqual({
            baseBranch: "trunk",
            repositoryId: added.id,
        });
    });

    it("unlinks a Repository: its Git links and Base branches go, other Repositories stay", async () => {
        const { guestMode, provider } = await startGuest();
        const apiId = guestMode.GUEST_DEMO_API_REPOSITORY_ID;
        const webId = guestMode.GUEST_DEMO_WEB_REPOSITORY_ID;

        const { data: count } = await provider.countRepositoryGitLinks(apiId);
        expect(count).toBeGreaterThan(0);
        const apiLinks = guestMode
            .getGuestSandbox()!
            .tasks.flatMap((task) => task.gitLinks ?? [])
            .filter((link) => link.repositoryId === apiId).length;
        expect(apiLinks).toBeGreaterThanOrEqual(count!);

        const { error } = await provider.removeProjectRepository(apiId);
        expect(error).toBeNull();

        const sandbox = guestMode.getGuestSandbox()!;
        const links = sandbox.tasks.flatMap((task) => task.gitLinks ?? []);
        expect(links.some((link) => link.repositoryId === apiId)).toBe(false);
        expect(links.some((link) => link.repositoryId === webId)).toBe(true);
        const feat2 = sandbox.tasks.find((task) => task.key === "FEAT-2")!;
        expect(feat2.gitLinks?.map((link) => link.repositoryId)).toEqual([
            webId,
        ]);
        const board = sandbox.boards.find(
            (item) => item.id === guestMode.GUEST_DEMO_BOARD_ID
        )!;
        expect(
            board.repositoryBaseBranches.map((entry) => entry.repositoryId)
        ).toEqual([webId]);
        expect(
            sandbox.activity.filter(
                (event) => event.metadata.reason === "repository_unlinked"
            )
        ).toHaveLength(apiLinks);
    });
});
