import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Kanban column mutation error handling", () => {
    it("wraps rename and delete awaits and keeps delete dialog on failure", () => {
        const column = readUi("kanban-column.tsx");

        expect(column).toMatch(/try\s*\{[\s\S]*renameColumn/);
        expect(column).toMatch(/try\s*\{[\s\S]*deleteColumn/);
        expect(column).toMatch(/setDeleteOpen\(false\)/);
        expect(column).toMatch(/catch\s*\{[\s\S]*return/);
    });
});

describe("Kanban board add-column error handling", () => {
    it("catches addColumn rejection", () => {
        const board = readUi("kanban-board.tsx");

        expect(board).toMatch(/addColumn[\s\S]*\.catch\(/);
    });
});
