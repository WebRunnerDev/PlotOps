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
    it("Repositories settings mount the picker for Owner/Admin only", () => {
        const settings = read(
            "src/routes/(main)/projects/$projectId/settings.tsx"
        );
        const section = read(
            "src/features/projects/ui/project-repositories-settings.tsx"
        );

        expect(settings).toMatch(/ProjectRepositoriesSettings/);
        expect(settings).toMatch(/canManage=\{[\s\S]*canManageSettings/);
        expect(section).toMatch(/ConnectProjectRepository/);
        expect(section).toMatch(/canAddRepositoryToProject/);
        expect(section).not.toMatch(/connectHint/);
    });

    it("picker connects via mutation and surfaces duplicate-repo errors", () => {
        const ui = read(
            "src/features/projects/ui/connect-project-repository.tsx"
        );

        expect(ui).toMatch(/useAddProjectRepository/);
        expect(ui).toMatch(/useGitHubRepos/);
        expect(ui).toMatch(/isUniqueViolation/);
        expect(ui).toMatch(/connectDuplicate/);
        expect(ui).toMatch(/mutateAsync/);
        expect(ui).toMatch(/ScrollArea/);
        expect(ui).not.toMatch(/overflow-y-auto/);
    });
});
