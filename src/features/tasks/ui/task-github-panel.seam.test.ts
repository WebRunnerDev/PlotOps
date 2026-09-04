import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("TaskGithubPanel Open/Merge/Close seam", () => {
    it("gates writes with canWriteGithubPr and hides guest path", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");

        expect(panel).toMatch(/canWriteGithubPr/);
        expect(panel).toMatch(/isGuest\(/);
        expect(panel).toMatch(/useCreatePullRequest/);
        expect(panel).toMatch(/useMergePullRequest/);
        expect(panel).toMatch(/useClosePullRequest/);
        expect(panel).toMatch(/github\.openPr/);
        expect(panel).toMatch(/github\.mergePr/);
        expect(panel).toMatch(/github\.closePr/);
        expect(panel).toMatch(/defaultPullRequestTitle/);
        expect(panel).toMatch(/mergeMethod/);
        expect(panel).toMatch(/gitHubWriteErrorKind/);
        expect(panel).not.toMatch(/approve/i);
    });

    it("shows Diff for guests and authed sessions via canFetchPullRequestFiles", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");

        expect(panel).toMatch(/canFetchPullRequestFiles/);
        expect(panel).toMatch(/canViewDiff/);
        expect(panel).toMatch(/git\.viewDiff/);
        expect(panel).toMatch(/PrDiffDialog/);
    });

    it("board locales include write action + error keys", () => {
        const en = read("src/app/locales/board/en.json");
        const ru = read("src/app/locales/board/ru.json");

        for (const source of [en, ru]) {
            expect(source).toMatch(/"openPr"/);
            expect(source).toMatch(/"mergePr"/);
            expect(source).toMatch(/"closePr"/);
            expect(source).toMatch(/"closePrTitle"/);
            expect(source).toMatch(/"closePrConfirm"/);
            expect(source).toMatch(/"mergeMethodSquash"/);
            expect(source).toMatch(/"writeError"/);
        }
    });
});
