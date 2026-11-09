import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("BoardSwitcher create dialog Base branch", () => {
    it("asks for a Base branch per Repository, not one shared value", () => {
        const switcher = read("features/boards/ui/board-switcher.tsx");

        expect(switcher).toMatch(
            /showGitBranchSettings\s*=\s*repositories\.length\s*>\s*0/
        );
        expect(switcher).toMatch(/<RepositoryBaseBranchFields/);
        expect(switcher).toMatch(/buildCreateBoardInput\(/);
        expect(switcher).not.toMatch(/baseBranch:\s*asDevelopment/);
        expect(switcher).not.toMatch(/defaultBaseBranch/);
    });

    it("callers pass the Project's Repositories, gated on a linked repo", () => {
        for (const caller of [
            "widgets/kanban-board/ui/board-page.tsx",
            "features/sprints/ui/backlog-page.tsx",
        ]) {
            const source = read(caller);
            expect(source, caller).toMatch(
                /projectHasGithubRepo\([^)]*\)\s*\?\s*toBoardSettingsRepositories\(/
            );
            expect(source, caller).not.toMatch(/defaultBaseBranch=/);
        }
    });
});
