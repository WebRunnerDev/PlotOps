import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("KanbanAddTask active sprint create seam", () => {
    it("passes createSprintId into createTask so active-scope cards stay visible", () => {
        const source = readFileSync(
            path.join(dirname, "kanban-add-task.tsx"),
            "utf8"
        );

        expect(source).toMatch(/createSprintId/);
        expect(source).toMatch(/sprintId:\s*createSprintId/);
        expect(source).toMatch(/createTask\(\s*status\s*,\s*trimmed/);
    });
});
