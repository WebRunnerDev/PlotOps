import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Home All projects seam", () => {
    it("keeps Teams-first with optional All projects navigate-only list", () => {
        const page = readUi("teams-page.tsx");

        expect(page).toMatch(/viewTeams/);
        expect(page).toMatch(/viewAllProjects/);
        expect(page).toMatch(/buildHomeAllProjects/);
        expect(page).toMatch(/useProjects/);
        expect(page).toMatch(/ProjectCard/);
        expect(page).toMatch(/teamName=\{teamName/);
        // Read-only: no delete / create-project on the flat list.
        expect(page).not.toMatch(/onRemove=/);
        expect(page).not.toMatch(/AddProjectDialog/);
        expect(page).not.toMatch(/useDeleteProject/);
    });

    it("ProjectCard stays navigate-only when onRemove is omitted", () => {
        const card = readUi("../../projects/ui/project-card.tsx");

        expect(card).toMatch(/to:\s*"\/projects\/\$projectId"/);
        expect(card).toMatch(/onRemove\?:/);
        expect(card).toMatch(
            /canDelete\s*=\s*Boolean\(onRemove\)\s*&&\s*isSettled\s*&&\s*canDeleteProject/
        );
    });
});
