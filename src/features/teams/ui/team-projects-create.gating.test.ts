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
    it("opens AddProjectDialog for Owner/Admin without requiring GitHub token", () => {
        const page = read("src/features/teams/ui/team-projects-page.tsx");
        expect(page).toMatch(/AddProjectDialog/);
        expect(page).toMatch(/canCreateProject/);
        expect(page).toMatch(/canAddProject/);
        expect(page).toMatch(/teamId=\{teamId\}/);
        expect(page).toMatch(/addProject/);
        expect(page).toMatch(
            /user\s*&&\s*canCreateProject\s*\?\s*\(\s*<AddProjectDialog/
        );
        expect(page).not.toMatch(
            /user\s*&&\s*githubAccessToken\s*&&\s*canCreateProject/
        );
    });
});
