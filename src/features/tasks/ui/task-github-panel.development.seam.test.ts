import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("TaskGithubPanel Development Board Open PR gate", () => {
    it("passes Base branch only when the Board is a Development Board", () => {
        const panel = read("src/features/tasks/ui/task-github-panel.tsx");
        const drawer = read("src/features/tasks/ui/task-drawer.tsx");

        expect(panel).toMatch(/baseBranch:\s*null\s*\|\s*string/);
        expect(panel).toMatch(
            /const canOpenPr\s*=\s*[\s\S]*Boolean\(baseBranch\)/
        );
        expect(drawer).toMatch(/currentBoard\?\.isDevelopment/);
        expect(drawer).not.toMatch(
            /currentBoard\?\.baseBranch\s*\?\?\s*["']main["']/
        );
    });
});
