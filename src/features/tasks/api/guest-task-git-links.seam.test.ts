import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";

async function startGuest() {
    const guestMode = await import("@/features/guest-mode");
    guestMode.startGuestSession();
    const sandbox = guestMode.getGuestSandbox()!;
    const task = sandbox.tasks.find((item) => item.key === "TASK-6")!;
    return { guestMode, provider: resolveTasksProvider(true), task };
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

describe("guest Task Git links per Repository (ADR 0035)", () => {
    it("maps the seeded two-PR Task to one Git link per Repository", async () => {
        const { guestMode, provider } = await startGuest();

        const { tasks } = await provider.fetchBoardTasks(
            guestMode.GUEST_DEMO_BOARD_ID
        );
        const feat2 = tasks.find((task) => task.key === "FEAT-2")!;

        expect(feat2.gitLinks).toEqual([
            expect.objectContaining({
                pr: expect.objectContaining({ number: 43, state: "open" }),
                repositoryId: guestMode.GUEST_DEMO_WEB_REPOSITORY_ID,
            }),
            expect.objectContaining({
                pr: expect.objectContaining({ number: 17, state: "merged" }),
                repositoryId: guestMode.GUEST_DEMO_API_REPOSITORY_ID,
            }),
        ]);
        expect(feat2.pr?.number).toBe(43);
    });

    it("writes a branch and a PR into separate Repositories of one Task", async () => {
        const { guestMode, provider, task } = await startGuest();
        const webId = guestMode.GUEST_DEMO_WEB_REPOSITORY_ID;
        const apiId = guestMode.GUEST_DEMO_API_REPOSITORY_ID;

        await provider.updateTaskDetails(task.id, {
            branch_name: "feature/TASK-6-chip",
            repository_id: webId,
        });
        await provider.updateTaskDetails(task.id, {
            branch_name: "feature/TASK-6-chip-api",
            pr_number: 21,
            pr_state: "open",
            pr_url: "https://github.com/plotops-demo/api/pull/21",
            repository_id: apiId,
        });

        let stored = guestMode
            .getGuestSandbox()!
            .tasks.find((item) => item.id === task.id)!;
        expect(stored.gitLinks).toEqual([
            {
                branchName: "feature/TASK-6-chip",
                id: expect.any(String),
                repositoryId: webId,
            },
            {
                branchName: "feature/TASK-6-chip-api",
                id: expect.any(String),
                pr: {
                    number: 21,
                    state: "open",
                    url: "https://github.com/plotops-demo/api/pull/21",
                },
                repositoryId: apiId,
            },
        ]);

        // A link left with neither branch nor PR is removed.
        await provider.updateTaskDetails(task.id, {
            branch_name: null,
            repository_id: webId,
        });
        stored = guestMode
            .getGuestSandbox()!
            .tasks.find((item) => item.id === task.id)!;
        expect(stored.gitLinks?.map((link) => link.repositoryId)).toEqual([
            apiId,
        ]);
    });

    it("requires a Repository when the Project holds several", async () => {
        const { provider, task } = await startGuest();

        await expect(
            provider.updateTaskDetails(task.id, {
                branch_name: "feature/TASK-6-chip",
            })
        ).rejects.toThrow(/repository_id is required/);
    });

    it("keeps several Git links of one Repository apart by id (#352)", async () => {
        const { guestMode, provider, task } = await startGuest();
        const webId = guestMode.GUEST_DEMO_WEB_REPOSITORY_ID;
        const read = () =>
            guestMode
                .getGuestSandbox()!
                .tasks.find((item) => item.id === task.id)!.gitLinks ?? [];

        await provider.updateTaskDetails(task.id, {
            branch_name: "feature/TASK-6-chip",
            git_link_id: "link-a",
            repository_id: webId,
        });
        await provider.updateTaskDetails(task.id, {
            branch_name: "hotfix/TASK-6",
            git_link_id: "link-b",
            pr_number: 30,
            pr_state: "open",
            pr_url: "https://github.com/plotops-demo/web/pull/30",
            repository_id: webId,
        });
        expect(read().map((link) => [link.id, link.branchName])).toEqual([
            ["link-a", "feature/TASK-6-chip"],
            ["link-b", "hotfix/TASK-6"],
        ]);

        // Without an id the Repository's Git link is ambiguous.
        await expect(
            provider.updateTaskDetails(task.id, {
                branch_name: null,
                repository_id: webId,
            })
        ).rejects.toThrow(/git_link_id is required/);

        // The same PR twice in one Repository is refused.
        await expect(
            provider.updateTaskDetails(task.id, {
                git_link_id: "link-c",
                pr_number: 30,
                pr_state: "open",
                pr_url: "https://github.com/plotops-demo/web/pull/30",
                repository_id: webId,
            })
        ).rejects.toThrow(/already linked/);

        await provider.updateTaskDetails(task.id, {
            branch_name: null,
            git_link_id: "link-a",
        });
        expect(read().map((link) => link.id)).toEqual(["link-b"]);
    });
});
