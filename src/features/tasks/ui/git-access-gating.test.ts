import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Git UI Role gating seam", () => {
    it("gates Task Git writes on canEditTasks via the same access seam as Board", () => {
        const drawer = readUi("task-drawer.tsx");
        const panel = readUi("task-github-panel.tsx");

        expect(drawer).toMatch(/useProjectAccess/);
        expect(drawer).toMatch(/canEditTasks/);
        expect(drawer).toMatch(/TaskGithubPanel[\s\S]*canEdit=\{canEdit\}/);
        expect(panel).toMatch(/canEdit/);
        expect(panel).toMatch(/github\.unlinkBranch|unlinkBranch/);
        expect(panel).toMatch(/github\.generateBranch|generateBranch/);
        expect(panel).toMatch(/github\.linkBranch|linkBranch/);
        expect(panel).toMatch(/github\.linkPr|linkPr/);
        expect(panel).toMatch(/github\.unlinkPr|unlinkPr/);
        expect(panel).toMatch(/git\.viewDiff|viewDiff/);
    });

    it("hides Git write affordances when canEdit is false and keeps viewDiff", () => {
        const panel = readUi("task-github-panel.tsx");

        // Write controls must be Role-gated (not always rendered).
        expect(panel).toMatch(/canEdit\s*&&|canEdit\s*\?/);
        // Diff for an already linked PR stays available without canEdit.
        expect(panel).toMatch(/git\.viewDiff/);
        expect(panel).not.toMatch(/canEdit\s*&&[\s\S]{0,80}git\.viewDiff/);
        expect(panel).not.toMatch(/canEdit\s*\?[\s\S]{0,80}git\.viewDiff/);
    });
});
