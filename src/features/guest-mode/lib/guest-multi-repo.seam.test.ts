import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    GUEST_DEMO_API_REPOSITORY_ID,
    GUEST_DEMO_PROJECT_ID,
    GUEST_DEMO_SEED,
    GUEST_DEMO_WEB_REPOSITORY_ID,
} from "./guest-demo-seed";

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

describe("«Web + API» demo Project (ADR 0035)", () => {
    const project = GUEST_DEMO_SEED.projects.find(
        (item) => item.id === GUEST_DEMO_PROJECT_ID
    )!;
    const tasks = GUEST_DEMO_SEED.tasks.filter(
        (task) => task.projectId === GUEST_DEMO_PROJECT_ID
    );

    it("holds two Repositories with their own default branches", () => {
        expect(project.name).toBe("Web + API");
        expect(
            project.repositories.map((repo) => [
                repo.fullName,
                repo.defaultBranch,
            ])
        ).toEqual([
            ["plotops-demo/web", "main"],
            ["plotops-demo/api", "develop"],
        ]);
    });

    it("has a Task with a merged PR in one Repository and an open PR in the other", () => {
        const both = tasks.filter((task) => {
            const links = task.gitLinks ?? [];
            return (
                links.length === 2 &&
                links.some((link) => link.pr?.state === "merged") &&
                links.some((link) => link.pr?.state === "open")
            );
        });
        expect(both).toHaveLength(1);
        expect(
            both[0]!.gitLinks!.map((link) => link.repositoryId).toSorted()
        ).toEqual(
            [
                GUEST_DEMO_API_REPOSITORY_ID,
                GUEST_DEMO_WEB_REPOSITORY_ID,
            ].toSorted()
        );
    });

    it("has a Task with a branch but no PR", () => {
        expect(
            tasks.some((task) =>
                task.gitLinks?.some((link) => link.branchName && !link.pr)
            )
        ).toBe(true);
    });

    it("gives every Development Board a Base branch per Repository", () => {
        const boards = GUEST_DEMO_SEED.boards.filter(
            (board) => board.projectId === GUEST_DEMO_PROJECT_ID
        );
        for (const board of boards) {
            expect(board.repositoryBaseBranches).toEqual([
                {
                    baseBranch: "main",
                    repositoryId: GUEST_DEMO_WEB_REPOSITORY_ID,
                },
                {
                    baseBranch: "develop",
                    repositoryId: GUEST_DEMO_API_REPOSITORY_ID,
                },
            ]);
        }
    });
});

describe("single-repo Guest Sessions saved before ADR 0035", () => {
    it("move the Project repo, Board Base branch and Task branch / PR into per-Repository rows", async () => {
        const guestMode = await import("@/features/guest-mode");
        guestMode.startGuestSession();
        const legacy = structuredClone(
            guestMode.getGuestSandbox()!
        ) as unknown as {
            boards: Array<Record<string, unknown>>;
            projects: Array<Record<string, unknown>>;
            tasks: Array<Record<string, unknown>>;
        };
        const projectId = GUEST_DEMO_PROJECT_ID;
        for (const project of legacy.projects) {
            delete project.repositories;
            const linked = project.id === projectId;
            project.githubDefaultBranch = linked ? "main" : null;
            project.githubFullName = linked ? "plotops-demo/plotops" : null;
            project.githubHtmlUrl = linked
                ? "https://github.com/plotops-demo/plotops"
                : null;
            project.githubRepoId = linked ? 999_000_001 : null;
        }
        for (const board of legacy.boards) {
            delete board.repositoryBaseBranches;
            delete board.isDevelopment;
            board.baseBranch = "main";
        }
        for (const task of legacy.tasks) {
            delete task.gitLinks;
        }
        const target = legacy.tasks.find(
            (task) => task.projectId === projectId
        )!;
        target.branchName = "feature/legacy";
        target.pr = {
            number: 7,
            state: "open",
            url: "https://github.com/plotops-demo/plotops/pull/7",
        };

        guestMode.writeGuestSandbox(
            legacy as unknown as Parameters<
                typeof guestMode.writeGuestSandbox
            >[0]
        );
        const migrated = guestMode.getGuestSandbox()!;

        const repoId = `${projectId}:repo`;
        const project = migrated.projects.find(
            (item) => item.id === projectId
        )!;
        expect(project.repositories).toEqual([
            {
                defaultBranch: "main",
                fullName: "plotops-demo/plotops",
                githubRepoId: 999_000_001,
                htmlUrl: "https://github.com/plotops-demo/plotops",
                id: repoId,
            },
        ]);
        expect("githubRepoId" in project).toBe(false);
        const plain = migrated.projects.find((item) => item.id !== projectId)!;
        expect(plain.repositories).toEqual([]);

        const board = migrated.boards.find(
            (item) => item.projectId === projectId
        )!;
        expect(board.isDevelopment).toBe(true);
        expect(board.repositoryBaseBranches).toEqual([
            { baseBranch: "main", repositoryId: repoId },
        ]);
        const plainBoard = migrated.boards.find(
            (item) => item.projectId === plain.id
        )!;
        expect(plainBoard.repositoryBaseBranches).toEqual([]);

        const task = migrated.tasks.find((item) => item.id === target.id)!;
        expect(task.gitLinks).toEqual([
            {
                branchName: "feature/legacy",
                pr: {
                    number: 7,
                    state: "open",
                    url: "https://github.com/plotops-demo/plotops/pull/7",
                },
                repositoryId: repoId,
            },
        ]);
    });
});
