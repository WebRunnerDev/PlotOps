import { describe, expect, it } from "vitest";

import type { BuildsRepository } from "@/features/ci-cd/model/types";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";
import {
    firstFeedPageParameter,
    getProjectBuildsStats,
    listProjectFeedPage,
} from "@/features/ci-cd/model/project-feed";

/** The «Web + API» Guest demo Repositories (ADR 0035). */
const WEB: BuildsRepository = {
    defaultBranch: "main",
    fullName: "plotops-demo/web",
    id: "repo-web",
};
const API: BuildsRepository = {
    defaultBranch: "develop",
    fullName: "plotops-demo/api",
    id: "repo-api",
};

describe("mock builds per Repository (Guest «Web + API»)", () => {
    it("serves the backend Repository its own runs on its own default branch", async () => {
        const web = await mockBuildsForProject.listBuilds(WEB);
        const api = await mockBuildsForProject.listBuilds(API);

        const webIds = new Set(web.builds.map((build) => build.id));
        expect(api.builds.length).toBeGreaterThan(0);
        expect(api.builds.some((build) => webIds.has(build.id))).toBe(false);
        expect(
            api.builds.every((build) => build.repositoryName === API.fullName)
        ).toBe(true);

        const stats = await mockBuildsForProject.getBuildsStats(API, {
            defaultBranch: API.defaultBranch,
        });
        expect(stats.defaultBranchBuild?.branch).toBe("develop");
        expect(stats.total).toBe(api.builds.length);
    });

    it("interleaves both Repositories in one feed, newest first", async () => {
        const page = await listProjectFeedPage(
            mockBuildsForProject,
            [WEB, API],
            firstFeedPageParameter([WEB, API])
        );

        const repositories = new Set(
            page.builds.map((build) => build.repositoryId)
        );
        expect(repositories).toEqual(new Set([API.id, WEB.id]));
        const starts = page.builds.map((build) => Date.parse(build.startedAt));
        expect(starts).toEqual(starts.toSorted((a, b) => b - a));
        // Interleaved by start time, not grouped by Repository.
        expect(
            new Set(page.builds.slice(0, 2).map((build) => build.repositoryId))
        ).toEqual(new Set([API.id, WEB.id]));
    });

    it("reads jobs and log scripts from the run's own Repository", async () => {
        const jobs = await mockBuildsForProject.listBuildJobs(
            API,
            "build-api-bug-11"
        );
        expect(jobs.map((job) => job.name)).toContain("pgTAP");
        expect(
            await mockBuildsForProject.listBuildJobs(WEB, "build-api-bug-11")
        ).toEqual([]);
    });

    it("sums stats across both Repositories", async () => {
        const stats = await getProjectBuildsStats(mockBuildsForProject, [
            WEB,
            API,
        ]);
        expect(stats.total.total).toBe(
            stats.byRepository[WEB.id]!.total +
                stats.byRepository[API.id]!.total
        );
        expect(
            stats.byRepository[API.id]!.defaultBranchBuild?.repositoryId
        ).toBe(API.id);
    });
});
