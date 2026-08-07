import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("AddProjectDialog name-only seam", () => {
    it("offers Connect GitHub vs Name only modes and null-github create path", () => {
        const dialog = readUi("add-project-dialog.tsx");

        expect(dialog).toMatch(/createProjectModeGitHub/);
        expect(dialog).toMatch(/createProjectModeNameOnly/);
        expect(dialog).toMatch(/mode:\s*"name-only"/);
        expect(dialog).toMatch(/mode:\s*"github"/);
        expect(dialog).toMatch(/isValidProjectName/);
        expect(dialog).toMatch(/isValidProjectSlug/);
        expect(dialog).not.toMatch(/mutateAsync\(\{\s*repo,/);
    });
});

describe("AddProjectDialog collaborator suggest seam", () => {
    it("after GitHub connect with token, opens skippable collaborator suggest step", () => {
        const dialog = readUi("add-project-dialog.tsx");

        expect(dialog).toMatch(/SuggestCollaboratorsStep/);
        expect(dialog).toMatch(/suggest-collaborators/);
        expect(dialog).toMatch(/collaboratorSuggestTitle/);
        expect(dialog).toMatch(/accessToken/);
    });
});
