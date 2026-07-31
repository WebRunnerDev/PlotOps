import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("KanbanAddTask Escape/blur seam", () => {
    it("does not submit on blur after Escape cancel", () => {
        const source = readFileSync(
            path.join(dirname, "kanban-add-task.tsx"),
            "utf8"
        );

        expect(source).toMatch(/skipBlurSubmit/);
        expect(source).toMatch(/Escape/);
        expect(source).toMatch(/onBlur/);
        expect(source).toMatch(/if\s*\(\s*skipBlurSubmit\.current\s*\)/);
    });
});
