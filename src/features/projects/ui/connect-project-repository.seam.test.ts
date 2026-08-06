import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("ConnectProjectRepository seam", () => {
    it("settings mounts connect UI for name-only Projects when Owner/Admin", () => {
        const settings = read(
            "src/routes/(main)/projects/$projectId/settings.tsx"
        );

        expect(settings).toMatch(/ConnectProjectRepository/);
        expect(settings).toMatch(/canManageSettings/);
        expect(settings).toMatch(/projectHasGithubRepo/);
        expect(settings).not.toMatch(/connectHint/);
    });

    it("picker connects via mutation and surfaces duplicate-repo errors", () => {
        const ui = read(
            "src/features/projects/ui/connect-project-repository.tsx"
        );

        expect(ui).toMatch(/useConnectProjectGithub/);
        expect(ui).toMatch(/useGitHubRepos/);
        expect(ui).toMatch(/isUniqueViolation/);
        expect(ui).toMatch(/connectDuplicate/);
        expect(ui).toMatch(/mutateAsync/);
    });
});
