import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function read(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("github-webhook close routing seam", () => {
    it("dispatches non-merge closes after merge path skip", () => {
        const index = read("index.ts");
        const sync = read("sync.ts");

        expect(index).toMatch(/syncMergedPullRequest/);
        expect(index).toMatch(/syncClosedPullRequest/);
        expect(index).toMatch(/not_merged_pr/);
        expect(sync).toMatch(/planClosePullRequestSync/);
        expect(sync).toMatch(/shouldHandleClosedUnmergedPr/);
        expect(sync).toMatch(/plan\.update/);
        expect(sync).toMatch(/closed_pr_synced/);
        expect(sync).not.toMatch(
            /syncClosedInProject[\s\S]{0,800}status:\s*lastColumnId/
        );
    });
});
