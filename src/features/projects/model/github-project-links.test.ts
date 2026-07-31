import { describe, expect, it } from "vitest";

import { buildGithubTreeUrl } from "@/features/projects/model/github-project-links";

describe("buildGithubTreeUrl", () => {
    it("returns undefined when github_html_url is null or missing", () => {
        expect(buildGithubTreeUrl(null, "main")).toBeUndefined();
        expect(buildGithubTreeUrl(undefined, "main")).toBeUndefined();
        expect(buildGithubTreeUrl("", "main")).toBeUndefined();
    });

    it("builds a tree URL and encodes branch path segments", () => {
        expect(
            buildGithubTreeUrl("https://github.com/org/repo/", "feature/x")
        ).toBe("https://github.com/org/repo/tree/feature/x");
        expect(buildGithubTreeUrl("https://github.com/org/repo", "main")).toBe(
            "https://github.com/org/repo/tree/main"
        );
    });
});
