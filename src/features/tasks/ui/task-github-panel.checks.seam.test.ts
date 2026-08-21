import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("TaskGithubPanel PR checks seam", () => {
    it("renders PrChecksSummary and loads checks via the git hook", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");
        const summary = read(
            "src/features/git-integration/ui/pr-checks-summary.tsx"
        );
        const hook = read("src/features/git-integration/model/use-git-data.ts");
        const fixtures = read(
            "src/features/git-integration/api/fixture-git-api.ts"
        );

        expect(panel).toMatch(/PrChecksSummary/);
        expect(summary).toMatch(/usePullRequestChecks/);
        expect(summary).toMatch(/canFetchPullRequestChecks/);
        expect(hook).toMatch(/fetchFixturePullRequestChecks/);
        expect(hook).toMatch(/fetchPullRequestChecks/);
        expect(hook).toMatch(/refetchInterval/);
        expect(fixtures).toMatch(/fetchFixturePullRequestChecks/);
        expect(fixtures).toMatch(/PlotOps Agent Review/);
    });

    it("board locales include checks keys", () => {
        const en = read("src/app/locales/board/en.json");
        const ru = read("src/app/locales/board/ru.json");

        for (const source of [en, ru]) {
            expect(source).toMatch(/"checks"/);
            expect(source).toMatch(/"rollup"/);
            expect(source).toMatch(/"authFailed"/);
        }
    });
});
