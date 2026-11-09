import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("ProjectNameSettings seam", () => {
    it("Project settings mount the rename section for Owner/Admin only", () => {
        const settings = read(
            "src/routes/(main)/projects/$projectId/settings.tsx"
        );

        expect(settings).toMatch(
            /<ProjectNameSettings\s+canManage=\{isSettled && canManageSettings\}/
        );
    });

    it("renames via useRenameProject, hides without access, blocks empty names", () => {
        const ui = read("src/features/projects/ui/project-name-settings.tsx");

        expect(ui).toMatch(/useRenameProject\(project\.id\)/);
        expect(ui).toMatch(/if \(!canManage\)\s*\{\s*return null;/);
        expect(ui).toMatch(/trimmed\.length > 0/);
        expect(ui).toMatch(/mutateAsync\(trimmed\)/);
    });
});
