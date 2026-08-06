import { describe, expect, it } from "vitest";

import { githubActionsBuilds } from "@/features/ci-cd/api/github-actions-builds";
import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";
import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";

describe("resolveBuildsProvider", () => {
    it("routes guest sessions through the canned mock builds provider", () => {
        expect(resolveBuildsProvider(true)).toBe(mockBuildsForProject);
    });

    it("routes signed-in non-guest sessions through GitHub Actions", () => {
        expect(resolveBuildsProvider(false)).toBe(githubActionsBuilds);
    });
});
