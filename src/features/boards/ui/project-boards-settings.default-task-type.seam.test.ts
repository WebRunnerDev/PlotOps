import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("ProjectBoardsSettings default task type seam", () => {
    it("edits and saves boards.default_task_type", () => {
        const source = readFileSync(
            path.join(dirname, "project-boards-settings.tsx"),
            "utf8"
        );

        expect(source).toMatch(/initialDefaultTaskType/);
        expect(source).toMatch(/default_task_type/);
        expect(source).toMatch(/defaultTaskType/);
        expect(source).toMatch(/TASK_TYPES|BoardDefaultTaskType|"bug"/);
    });
});
