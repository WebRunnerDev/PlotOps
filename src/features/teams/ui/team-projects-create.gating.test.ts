import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.."
);

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Team projects create affordance seam", () => {
    it("Team projects page can open AddProjectDialog for managers with GitHub", () => {
        const page = read("src/features/teams/ui/team-projects-page.tsx");
        expect(page).toMatch(/AddProjectDialog/);
        expect(page).toMatch(/canCreateProject/);
        expect(page).toMatch(/teamId=\{teamId\}/);
        expect(page).toMatch(/addProject/);
    });
});
