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
    it("gates CI/CD on the Project's Repositories, not github_repo_id", () => {
        const page = read("src/features/ci-cd/ui/ci-cd-page.tsx");
        const hook = read("src/features/ci-cd/model/use-project-builds.ts");

        expect(page).toMatch(/hasRepositories/);
        expect(page).toMatch(/project\?\.repositories/);
        expect(page).toMatch(/cicd\.connectRepo/);
        expect(page).toMatch(/resolveProjectConnectHash/);
        expect(page).toMatch(/to=["']\/projects\/\$projectId\/settings["']/);
        expect(page).toMatch(/useProjectBuilds\(\s*projectId,\s*repositories/);
        expect(page).not.toMatch(/github_repo_id/);
        expect(hook).toMatch(
            /canFetchProjectBuilds\(\{[\s\S]*repositoryCount: repositories\.length/
        );
    });

    it("anchors project settings connect section for Git/CI deep-links", () => {
        const settings = read(
            "src/routes/(main)/projects/$projectId/settings.tsx"
        );
        const repositories = read(
            "src/features/projects/ui/project-repositories-settings.tsx"
        );
        expect(settings).toMatch(/ProjectRepositoriesSettings/);
        expect(settings).toMatch(/projectHasGithubRepo/);
        expect(repositories).toMatch(/resolveProjectConnectHash/);
        expect(repositories).toMatch(/settings\.repository\.connect/);
    });
});
