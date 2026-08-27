import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("useBoardTasks archive lifecycle batch seam", () => {
    it("exposes restoreTasks and deleteTasks that reuse single-record mutations", () => {
        const source = fs.readFileSync(
            path.join(dirname, "use-board-tasks.ts"),
            "utf8"
        );

        expect(source).toMatch(/const restoreTasks = async/);
        expect(source).toMatch(/const deleteTasks = async/);
        expect(source).toMatch(/restoreTasks,/);
        expect(source).toMatch(/deleteTasks,/);
        expect(source).toMatch(
            /restoreTask:\s*async\s*\(taskId:\s*string\)\s*=>\s*\{\s*await restoreTasks\(\[taskId\]\)/
        );
        expect(source).toMatch(
            /deleteTask:\s*async\s*\(taskId:\s*string\)\s*=>\s*\{\s*[\s\S]*?await deleteTasks\(\[taskId\]\)/
        );
    });
});
