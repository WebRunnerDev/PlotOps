import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("TaskGithubPanel Open/Merge/Close/Approve seam", () => {
    it("gates writes with canWriteGithubPr and review with canReviewGithubPr", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");

        expect(panel).toMatch(/canWriteGithubPr/);
        expect(panel).toMatch(/canReviewGithubPr/);
        expect(panel).toMatch(/isGuest\(/);
        expect(panel).toMatch(/useCreatePullRequest/);
        expect(panel).toMatch(/useMergePullRequest/);
        expect(panel).toMatch(/useClosePullRequest/);
        expect(panel).toMatch(/useApprovePullRequest/);
        expect(panel).toMatch(/github\.openPr/);
        expect(panel).toMatch(/github\.mergePr/);
        expect(panel).toMatch(/github\.closePr/);
        expect(panel).toMatch(/github\.approvePr/);
        expect(panel).toMatch(/defaultPullRequestTitle/);
        expect(panel).toMatch(/mergeMethod/);
        expect(panel).toMatch(/gitHubWriteErrorKind/);
        expect(panel).toMatch(/handleApprovePr/);
    });

    it("Approve success does not call onPrChange", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");
        const approveHandler = panel.match(
            /const handleApprovePr = async \(\) => \{[\s\S]*?\n {4}\};/
        )?.[0];

        expect(approveHandler).toBeDefined();
        expect(approveHandler).not.toMatch(/onPrChange/);
        expect(approveHandler).toMatch(/approvePrToast/);
    });

    it("shows Diff for guests and authed sessions via canFetchPullRequestFiles", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");

        expect(panel).toMatch(/canFetchPullRequestFiles/);
        expect(panel).toMatch(/canViewDiff/);
        expect(panel).toMatch(/git\.viewDiff/);
        expect(panel).toMatch(/PrDiffDialog/);
    });

    it("board locales include write + approve action + error keys", () => {
        const en = read("src/app/locales/board/en.json");
        const ru = read("src/app/locales/board/ru.json");

        for (const source of [en, ru]) {
            expect(source).toMatch(/"openPr"/);
            expect(source).toMatch(/"mergePr"/);
            expect(source).toMatch(/"closePr"/);
            expect(source).toMatch(/"closePrTitle"/);
            expect(source).toMatch(/"closePrConfirm"/);
            expect(source).toMatch(/"approvePr"/);
            expect(source).toMatch(/"approvePrToast"/);
            expect(source).toMatch(/"approvePrFailed"/);
            expect(source).toMatch(/"mergeMethodSquash"/);
            expect(source).toMatch(/"writeError"/);
        }
    });
});
