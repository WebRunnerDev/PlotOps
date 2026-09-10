import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("KanbanAddTask active sprint create seam", () => {
    it("passes resolved Sprint id (or picker choice) into createTask", () => {
        const source = readFileSync(
            path.join(dirname, "kanban-add-task.tsx"),
            "utf8"
        );

        expect(source).toMatch(/createSprintId/);
        expect(source).toMatch(/createSprintChoices/);
        expect(source).toMatch(/sprintId:\s*resolvedSprintId/);
        expect(source).toMatch(/createTask\(\s*status\s*,\s*trimmed/);
        expect(source).toMatch(/sprints\.createPickRequired/);
    });
});
