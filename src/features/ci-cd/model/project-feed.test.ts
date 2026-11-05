import { describe, expect, it } from "vitest";

import type {
    BuildsForProject,
    BuildsRepository,
    BuildsStats,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import { CiCdUnauthorizedError } from "@/features/ci-cd/api/github-actions-builds";
import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";
import {
    ALL_REPOSITORIES,
    filterBuildsByRepository,
    firstFeedPageParameter,
    getProjectBuildsStats,
    listProjectFeedPage,
    mergeFeedPages,
    nextFeedPageParameter,
    pickRepositoryStats,
    sumBuildsStats,
} from "@/features/ci-cd/model/project-feed";

const WEB: BuildsRepository = {
    defaultBranch: "main",
    fullName: "org/web",
    id: "repo-web",
};
const API: BuildsRepository = {
    defaultBranch: "develop",
    fullName: "org/api",
    id: "repo-api",
};

/** Provider over fixed per-Repository run lists; `failing` repos reject. */
function fakeProvider(
    runs: Record<string, ProjectBuild[]>,
    failing: Record<string, Error> = {}
): BuildsForProject {
    return {
        ...mockBuildsForProject,
        async getBuildsStats(repository, options) {
            const failure = failing[repository.id];
            if (failure) throw failure;
            const list = runs[repository.id] ?? [];
            return {
                defaultBranchBuild: list.find(
                    (build) => build.branch === options?.defaultBranch
                ),
                failure: list.filter((build) => build.status === "failure")
                    .length,
                running: list.filter(
                    (build) =>
                        build.status === "running" || build.status === "queued"
                ).length,
                success: list.filter((build) => build.status === "success")
                    .length,
                total: list.length,
            };
        },
        async listBuilds(repository, options) {
            const failure = failing[repository.id];
            if (failure) throw failure;
            const list = runs[repository.id] ?? [];
            const page = options?.page ?? 1;
            const perPage = options?.perPage ?? 30;
            const start = (page - 1) * perPage;
            return {
                builds: list.slice(start, start + perPage),
                hasMore: page * perPage < list.length,
                page,
            };
        },
    };
}

function run(
    repository: BuildsRepository,
    id: string,
    startedAt: string,
    overrides: Partial<ProjectBuild> = {}
): ProjectBuild {
    return {
        branch: repository.defaultBranch,
        commitMessage: `run ${id}`,
        commitSha: "abc1234",
        htmlUrl: `https://github.com/${repository.fullName}/actions/runs/${id}`,
        id,
        repositoryId: repository.id,
        repositoryName: repository.fullName,
        startedAt,
        status: "success",
        workflowName: "CI",
        ...overrides,
    };
}

describe("Project CI/CD feed across Repositories (ADR 0035)", () => {
    const runs = {
        [API.id]: [
            run(API, "a2", "2026-07-24T10:30:00.000Z"),
            run(API, "a1", "2026-07-24T08:00:00.000Z"),
        ],
        [WEB.id]: [
            run(WEB, "w2", "2026-07-24T11:00:00.000Z"),
            run(WEB, "w1", "2026-07-24T09:00:00.000Z"),
        ],
    };

    it("puts runs of both Repositories in one feed, newest first", async () => {
        const page = await listProjectFeedPage(
            fakeProvider(runs),
            [WEB, API],
            firstFeedPageParameter([WEB, API])
        );

        expect(page.builds.map((build) => build.id)).toEqual([
            "w2",
            "a2",
            "w1",
            "a1",
        ]);
        expect(page.failedRepositoryIds).toEqual([]);
    });

    it("narrows the feed to one Repository with the Repo filter", async () => {
        const page = await listProjectFeedPage(
            fakeProvider(runs),
            [WEB, API],
            firstFeedPageParameter([WEB, API])
        );

        const apiOnly = filterBuildsByRepository(page.builds, API.id);
        expect(apiOnly.map((build) => build.id)).toEqual(["a2", "a1"]);
        expect(
            apiOnly.every((build) => build.repositoryName === "org/api")
        ).toBe(true);
        expect(filterBuildsByRepository(page.builds, ALL_REPOSITORIES)).toEqual(
            page.builds
        );
    });

    it("shows the other Repositories when one request fails", async () => {
        const page = await listProjectFeedPage(
            fakeProvider(runs, { [API.id]: new Error("GitHub API 404") }),
            [WEB, API],
            firstFeedPageParameter([WEB, API])
        );

        expect(page.builds.map((build) => build.id)).toEqual(["w2", "w1"]);
        expect(page.failedRepositoryIds).toEqual([API.id]);
        expect(mergeFeedPages([page]).failedRepositoryIds).toEqual([API.id]);
    });

    it("rejects when every Repository fails on the first page", async () => {
        await expect(
            listProjectFeedPage(
                fakeProvider(runs, {
                    [API.id]: new Error("GitHub API 500"),
                    [WEB.id]: new Error("GitHub API 500"),
                }),
                [WEB, API],
                firstFeedPageParameter([WEB, API])
            )
        ).rejects.toThrow("GitHub API 500");
    });

    it("rejects on a token error even if another Repository loaded", async () => {
        await expect(
            listProjectFeedPage(
                fakeProvider(runs, { [API.id]: new CiCdUnauthorizedError() }),
                [WEB, API],
                firstFeedPageParameter([WEB, API])
            )
        ).rejects.toBeInstanceOf(CiCdUnauthorizedError);
    });

    it("pages on only through Repositories that have more runs", async () => {
        const provider = fakeProvider({
            [API.id]: [run(API, "a1", "2026-07-24T08:00:00.000Z")],
            [WEB.id]: [
                run(WEB, "w3", "2026-07-24T12:00:00.000Z"),
                run(WEB, "w2", "2026-07-24T11:00:00.000Z"),
                run(WEB, "w1", "2026-07-24T07:00:00.000Z"),
            ],
        });

        const first = await listProjectFeedPage(
            provider,
            [WEB, API],
            firstFeedPageParameter([WEB, API]),
            2
        );
        const nextParameter = nextFeedPageParameter(first);
        expect(nextParameter).toEqual({ page: 2, repositoryIds: [WEB.id] });

        const second = await listProjectFeedPage(
            provider,
            [WEB, API],
            nextParameter!,
            2
        );
        expect(nextFeedPageParameter(second)).toBeUndefined();

        expect(
            mergeFeedPages([first, second]).builds.map((build) => build.id)
        ).toEqual(["w3", "w2", "a1", "w1"]);
    });

    it("keeps runs with the same id in different Repositories apart", () => {
        const merged = mergeFeedPages([
            {
                builds: [
                    run(WEB, "1", "2026-07-24T09:00:00.000Z"),
                    run(API, "1", "2026-07-24T10:00:00.000Z"),
                ],
                failedRepositoryIds: [],
                moreRepositoryIds: [],
                page: 1,
            },
        ]);
        expect(merged.builds.map((build) => build.repositoryId)).toEqual([
            API.id,
            WEB.id,
        ]);
    });
});

describe("Project CI/CD stats across Repositories", () => {
    it("sums totals and keeps per-Repository stats for the Repo filter", async () => {
        const stats = await getProjectBuildsStats(
            fakeProvider({
                [API.id]: [
                    run(API, "a1", "2026-07-24T08:00:00.000Z", {
                        status: "failure",
                    }),
                ],
                [WEB.id]: [
                    run(WEB, "w2", "2026-07-24T11:00:00.000Z"),
                    run(WEB, "w1", "2026-07-24T09:00:00.000Z", {
                        branch: "feature/x",
                        status: "running",
                    }),
                ],
            }),
            [WEB, API]
        );

        expect(stats.total).toMatchObject({
            failure: 1,
            running: 1,
            success: 1,
            total: 3,
        });
        // A failing default branch anywhere outranks a passing one.
        expect(stats.total.defaultBranchBuild?.id).toBe("a1");
        expect(pickRepositoryStats(stats, WEB.id)).toMatchObject({
            failure: 0,
            total: 2,
        });
        expect(pickRepositoryStats(stats, ALL_REPOSITORIES)).toBe(stats.total);
    });

    it("leaves a failed Repository out of the sums", async () => {
        const stats = await getProjectBuildsStats(
            fakeProvider(
                { [WEB.id]: [run(WEB, "w1", "2026-07-24T09:00:00.000Z")] },
                { [API.id]: new Error("GitHub API 403") }
            ),
            [WEB, API]
        );

        expect(stats.total.total).toBe(1);
        expect(stats.failedRepositoryIds).toEqual([API.id]);
        expect(pickRepositoryStats(stats, API.id)).toBeUndefined();
    });

    it("prefers the newest default-branch run among equal statuses", () => {
        const older: BuildsStats = {
            defaultBranchBuild: run(WEB, "w1", "2026-07-24T09:00:00.000Z"),
            failure: 0,
            running: 0,
            success: 1,
            total: 1,
        };
        const newer: BuildsStats = {
            ...older,
            defaultBranchBuild: run(API, "a1", "2026-07-24T10:00:00.000Z"),
        };
        expect(sumBuildsStats([older, newer]).defaultBranchBuild?.id).toBe(
            "a1"
        );
    });
});
