import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BacklogAddTask create seam", () => {
    it("creates into the section sprint (or backlog when sprintId is null)", () => {
        const source = readFileSync(
            path.join(dirname, "backlog-add-task.tsx"),
            "utf8"
        );

        expect(source).toMatch(/sprintId:\s*sprintId\s*\?\?\s*undefined/);
        expect(source).toMatch(/createTask\(\s*status\s*,\s*trimmed/);
        expect(source).toMatch(/canCreateTasks/);
    });
});

describe("BacklogPage wires create composers", () => {
    it("renders BacklogAddTask for planning sprints and the backlog section", () => {
        const source = readFileSync(
            path.join(dirname, "backlog-page.tsx"),
            "utf8"
        );

        expect(source).toMatch(/BacklogAddTask/);
        expect(source).toMatch(/sprintId=\{sprint\.id\}/);
        expect(source).toMatch(/sprintId=\{null\}/);
        expect(source).toMatch(/firstColumnId/);
    });
});
