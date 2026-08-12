import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("useBoardTasks archiveTasks seam", () => {
    it("batches archive through archiveTaskRecords and shares single-task path", () => {
        const source = fs.readFileSync(
            path.join(dirname, "use-board-tasks.ts"),
            "utf8"
        );

        expect(source).toMatch(/archiveTaskRecords/);
        expect(source).toMatch(/const archiveTasks = async/);
        expect(source).toMatch(/archiveTasks,/);
        expect(source).toMatch(
            /archiveTask:\s*async\s*\(taskId:\s*string\)\s*=>\s*\{\s*await archiveTasks\(\[taskId\]\)/
        );
        expect(source).not.toMatch(
            /insertTaskActivityEvent\(\{[\s\S]*field:\s*"archived",\s*from:\s*false/
        );
    });
});
