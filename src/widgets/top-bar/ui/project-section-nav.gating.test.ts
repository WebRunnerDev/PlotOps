import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Project section nav presence seam", () => {
    it("always renders Settings and CI/CD without early-returning the nav", () => {
        const nav = readUi("project-section-nav.tsx");

        expect(nav).not.toMatch(/if\s*\(\s*!boardId\s*\)\s*return\s+null/);
        expect(nav).toMatch(/to:\s*"\/projects\/\$projectId\/ci-cd"/);
        expect(nav).toMatch(/to:\s*"\/projects\/\$projectId\/settings"/);
        expect(nav).toMatch(/isPending|isError/);
        expect(nav).toMatch(/resolveSectionNavBoardId/);
    });
});
