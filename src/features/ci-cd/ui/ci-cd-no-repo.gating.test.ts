import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("CI/CD no-repo gate seam (#176)", () => {
    it("passes github_repo_id into canFetchProjectBuilds and useProjectBuilds", () => {
        const page = read("src/features/ci-cd/ui/ci-cd-page.tsx");
        const hook = read("src/features/ci-cd/model/use-project-builds.ts");

        expect(page).toMatch(/projectHasGithubRepo/);
        expect(page).toMatch(/cicd\.connectRepo/);
        expect(page).toMatch(/resolveProjectConnectHash/);
        expect(page).toMatch(/to=["']\/projects\/\$projectId\/settings["']/);
        expect(page).toMatch(
            /useProjectBuilds\(\s*projectId,\s*project\?\.github_repo_id/
        );
        expect(hook).toMatch(/githubRepoId/);
        expect(hook).toMatch(/canFetchProjectBuilds\(\{[\s\S]*githubRepoId/);
    });

    it("anchors project settings connect section for Git/CI deep-links", () => {
        const settings = read(
            "src/routes/(main)/projects/$projectId/settings.tsx"
        );
        expect(settings).toMatch(/resolveProjectConnectHash/);
        expect(settings).toMatch(/settings\.repository\.connect/);
        expect(settings).toMatch(/projectHasGithubRepo/);
    });
});
