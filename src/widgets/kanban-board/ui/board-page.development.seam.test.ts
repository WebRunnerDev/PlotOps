import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BoardPage Development Board chrome", () => {
    it("shows a Base branch chip per Repository, only for Development Boards", () => {
        const source = readFileSync(
            path.join(dirname, "board-page.tsx"),
            "utf8"
        );

        expect(source).toMatch(/resolveBoardBaseBranchChips\(/);
        expect(source).toMatch(/isDevelopment:\s*currentBoard\.isDevelopment/);
        expect(source).toMatch(/repositoryBaseBranches/);
        expect(source).not.toMatch(
            /currentBoard\.baseBranch\s*\|\|\s*project\.github_default_branch\s*\|\|\s*["']main["']/
        );
    });
});
