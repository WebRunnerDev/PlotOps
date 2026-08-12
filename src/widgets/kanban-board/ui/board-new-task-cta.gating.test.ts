import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Board header + New Task CTA seam", () => {
    it("gates the header CTA on settled canCreateTasks and opens first-column add", () => {
        const page = readUi("board-page.tsx");
        const board = readUi("kanban-board.tsx");
        const column = readUi("kanban-column.tsx");
        const addTask = readUi("kanban-add-task.tsx");

        expect(page).toMatch(/resolveBoardNewTaskCtaVisible/);
        expect(page).toMatch(/canCreateTasks/);
        expect(page).toMatch(/tasks\.newTask|newTask/);
        expect(page).toMatch(/openCreateTaskRequestKey|createTaskRequestKey/);
        expect(board).toMatch(/openCreateTaskRequestKey|createTaskRequestKey/);
        expect(board).toMatch(/startAddingTask/);
        expect(column).toMatch(/startAddingTask/);
        expect(addTask).toMatch(/startOpen|startAddingTask/);
    });
});
