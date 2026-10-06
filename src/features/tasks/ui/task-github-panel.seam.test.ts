import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("TaskGithubPanel Open/Merge/Close/Reopen/Approve seam", () => {
    it("gates writes with canWriteGithubPr and review with canReviewGithubPr", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");

        expect(panel).toMatch(/canWriteGithubPr/);
        expect(panel).toMatch(/canReviewGithubPr/);
        expect(panel).toMatch(/isGuest\(/);
        expect(panel).toMatch(/useCreatePullRequest/);
        expect(panel).toMatch(/useMergePullRequest/);
        expect(panel).toMatch(/useClosePullRequest/);
        expect(panel).toMatch(/useReopenPullRequest/);
        expect(panel).toMatch(/useApprovePullRequest/);
        expect(panel).toMatch(/github\.openPr/);
        expect(panel).toMatch(/github\.mergePr/);
        expect(panel).toMatch(/github\.closePr/);
        expect(panel).toMatch(/github\.reopenPr/);
        expect(panel).toMatch(/github\.approvePr/);
        expect(panel).toMatch(/defaultPullRequestTitle/);
        expect(panel).toMatch(/mergeMethod/);
        expect(panel).toMatch(/gitHubWriteErrorKind/);
        expect(panel).toMatch(/handleApprovePr/);
    });

    it("offers Reopen only for closed (never merged) PRs behind the write gate", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");
        const gate = panel.match(/const canReopenPr =[\s\S]*?;/)?.[0];

        expect(gate).toBeDefined();
        expect(gate).toMatch(/canWritePr/);
        expect(gate).toMatch(/canFetchGithub/);
        expect(gate).toMatch(/task\.pr\?\.state === "closed"/);
        expect(gate).not.toMatch(/merged/);
    });

    it("Reopen success sets local pr state to open", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");
        const reopenHandler = panel.match(
            /const handleReopenPr = async \(\) => \{[\s\S]*?\n {4}\};/
        )?.[0];

        expect(reopenHandler).toBeDefined();
        expect(reopenHandler).toMatch(/canReopenPr/);
        expect(reopenHandler).toMatch(/state: "open"/);
        expect(reopenHandler).toMatch(/reopenPrToast/);
        expect(reopenHandler).toMatch(/toastWriteFailure/);
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

    it("offers Request review on open PRs behind the review gate, not the write gate", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");
        const gate = panel.match(/const canRequestReview =[\s\S]*?;/)?.[0];

        expect(gate).toBeDefined();
        expect(gate).toMatch(/canReviewPr/);
        expect(gate).toMatch(/canFetchGithub/);
        expect(gate).toMatch(/task\.pr\?\.state === "open"/);
        expect(gate).not.toMatch(/canWritePr/);
        expect(panel).toMatch(/useRequestPullRequestReviewers/);
        expect(panel).toMatch(/RequestReviewDialog/);
        expect(panel).toMatch(/github\.requestReview"/);
    });

    it("Request review success neither approves, merges, nor touches pr state", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");
        const handler = panel.match(
            /const handleRequestReview = async \([\s\S]*?\n {4}\};/
        )?.[0];

        expect(handler).toBeDefined();
        expect(handler).toMatch(/canRequestReview/);
        expect(handler).toMatch(/requestReview\.mutateAsync/);
        expect(handler).toMatch(/requestReviewToast/);
        expect(handler).toMatch(/requestReviewErrorKind/);
        expect(handler).toMatch(/toastWriteFailure/);
        expect(handler).not.toMatch(/onPrChange/);
        expect(handler).not.toMatch(/approvePr|mergePr/);
    });

    it("reviewer picker rules out the author and already-requested logins", () => {
        const dialog = read(
            "src/features/git-integration/ui/request-review-dialog.tsx"
        );

        expect(dialog).toMatch(/usePullRequestReviewerCandidates/);
        expect(dialog).toMatch(/reviewerLoginStatus/);
        expect(dialog).toMatch(/requestReviewAlreadyRequested/);
        expect(dialog).toMatch(/requestReviewError\.author/);
        expect(dialog).toMatch(/selected\.length === 0/);
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
            expect(source).toMatch(/"reopenPr"/);
            expect(source).toMatch(/"reopenPrToast"/);
            expect(source).toMatch(/"reopenPrFailed"/);
            expect(source).toMatch(/"approvePr"/);
            expect(source).toMatch(/"approvePrToast"/);
            expect(source).toMatch(/"approvePrFailed"/);
            expect(source).toMatch(/"requestReview"/);
            expect(source).toMatch(/"requestReviewTitle"/);
            expect(source).toMatch(/"requestReviewToast"/);
            expect(source).toMatch(/"requestReviewFailed"/);
            expect(source).toMatch(/"requestReviewAlreadyRequested"/);
            expect(source).toMatch(/"invalid_reviewer"/);
            expect(source).toMatch(/"mergeMethodSquash"/);
            expect(source).toMatch(/"writeError"/);
        }
    });
});
