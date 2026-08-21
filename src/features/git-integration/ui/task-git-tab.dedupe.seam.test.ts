import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("TaskGitTab dedupe seam", () => {
    it("does not restate task key or branch meta already shown in the GitHub panel", () => {
        const tab = read("src/features/git-integration/ui/task-git-tab.tsx");

        expect(tab).not.toMatch(/git\.taskKeyLabel/);
        expect(tab).not.toMatch(/git\.branchLabel/);
        expect(tab).not.toMatch(/git\.smartCommitsTitle/);
        expect(tab).not.toMatch(/smartCommitsBody/);
    });

    it("hides the branch PR list when a task-linked PR is present", () => {
        const tab = read("src/features/git-integration/ui/task-git-tab.tsx");
        const drawer = read("src/features/tasks/ui/task-drawer.tsx");

        expect(tab).toMatch(/linkedPrNumber/);
        expect(tab).toMatch(/showBranchPrs/);
        expect(drawer).toMatch(/linkedPrNumber=\{\s*task\.pr\?\.number/);
    });
});
