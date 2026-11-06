import { describe, expect, it } from "vitest";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";

const REPOSITORY = {
    defaultBranch: "main",
    fullName: "org/repo",
    id: "repo-1",
};

describe("CI/CD builds-for-Project seam", () => {
    it("lists mock builds keyed by branch with success and failure statuses", async () => {
        const { builds } = await mockBuildsForProject.listBuilds(REPOSITORY);

        expect(builds.length).toBeGreaterThanOrEqual(2);

        const byBranch = Object.fromEntries(
            builds.map((build) => [build.branch, build.status])
        );

        expect(byBranch.main).toBe("success");
        expect(byBranch["feature/analytics"]).toBe("failure");
    });

    it("tags every run with the Repository it was listed for", async () => {
        const { builds } = await mockBuildsForProject.listBuilds({
            defaultBranch: "develop",
            fullName: "org/api",
            id: "repo-2",
        });

        for (const build of builds) {
            expect(build).toEqual(
                expect.objectContaining({
                    branch: expect.any(String),
                    commitSha: expect.any(String),
                    htmlUrl: expect.any(String),
                    id: expect.any(String),
                    repositoryId: "repo-2",
                    repositoryName: "org/api",
                    status: expect.stringMatching(
                        /^(failure|queued|running|success)$/
                    ),
                    workflowName: expect.any(String),
                })
            );
        }
    });

    it("paginates mock builds with hasMore across pages", async () => {
        const first = await mockBuildsForProject.listBuilds(REPOSITORY, {
            page: 1,
            perPage: 2,
        });
        const second = await mockBuildsForProject.listBuilds(REPOSITORY, {
            page: 2,
            perPage: 2,
        });
        const third = await mockBuildsForProject.listBuilds(REPOSITORY, {
            page: 3,
            perPage: 2,
        });

        expect(first.builds).toHaveLength(2);
        expect(first.hasMore).toBe(true);
        expect(first.page).toBe(1);

        expect(second.builds).toHaveLength(2);
        expect(second.hasMore).toBe(false);
        expect(second.page).toBe(2);

        expect(third.builds).toHaveLength(0);
        expect(third.hasMore).toBe(false);
    });
});
