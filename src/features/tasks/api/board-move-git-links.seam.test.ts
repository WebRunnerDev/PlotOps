import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Board move keeps Git links (ADR 0035)", () => {
    it("moves only the tasks row — task_git_links stay keyed by task_id", () => {
        const api = read("src/features/tasks/api/tasks-api.ts");
        const move = api.match(
            /export async function moveTaskToBoard\([\s\S]*?\n\}/
        )?.[0];

        expect(move).toBeDefined();
        expect(move).toMatch(/\.from\("tasks"\)/);
        expect(move).not.toMatch(/task_git_links|branch_name|pr_number/);
    });
});
