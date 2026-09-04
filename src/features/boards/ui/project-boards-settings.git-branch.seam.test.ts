import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("ProjectBoardsSettings git-branch gate", () => {
    it("hides base branch and allowed patterns unless GitHub repo is linked", () => {
        const settingsUi = read(
            "features/boards/ui/project-boards-settings.tsx"
        );
        const settingsRoute = read(
            "routes/(main)/projects/$projectId/settings.tsx"
        );

        expect(settingsUi).toMatch(/showGitBranchSettings/);
        expect(settingsUi).toMatch(
            /showGitBranchSettings\s*\?\s*[\s\S]*boards\.baseBranch/
        );
        expect(settingsUi).toMatch(
            /showGitBranchSettings\s*\?\s*[\s\S]*boards\.allowedPatterns/
        );

        expect(settingsRoute).toMatch(/projectHasGithubRepo/);
        expect(settingsRoute).toMatch(
            /showGitBranchSettings=\{[\s\S]*repoLinked/
        );
    });
});
