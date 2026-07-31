import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("KanbanColumn Escape/blur rename seam", () => {
    it("does not commit rename on blur after Escape cancel", () => {
        const source = readFileSync(
            path.join(dirname, "kanban-column.tsx"),
            "utf8"
        );

        expect(source).toMatch(/skipBlurCommit/);
        expect(source).toMatch(/Escape/);
        expect(source).toMatch(/if\s*\(\s*skipBlurCommit\.current\s*\)/);
    });
});
