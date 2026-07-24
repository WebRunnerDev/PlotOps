import { describe, expect, it } from "vitest";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";

describe("CI/CD builds-for-Project seam", () => {
    it("lists mock builds keyed by branch with success and failure statuses", async () => {
        const builds = await mockBuildsForProject.listBuilds("project-demo");

        expect(builds.length).toBeGreaterThanOrEqual(2);

        const byBranch = Object.fromEntries(
            builds.map((build) => [build.branch, build.status])
        );

        expect(byBranch.main).toBe("success");
        expect(byBranch["feature/analytics"]).toBe("failure");
    });

    it("returns the same Project-scoped shape for any projectId (mock)", async () => {
        const builds = await mockBuildsForProject.listBuilds("another-project");

        for (const build of builds) {
            expect(build).toEqual(
                expect.objectContaining({
                    branch: expect.any(String),
                    commitSha: expect.any(String),
                    id: expect.any(String),
                    status: expect.stringMatching(
                        /^(failure|queued|running|success)$/
                    ),
                })
            );
        }
    });
});
