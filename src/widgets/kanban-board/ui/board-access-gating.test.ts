import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Board UI Role gating seam", () => {
    it("gates Task status DnD on canEditTasks from Team-backed useProjectAccess", () => {
        const board = readUi("kanban-board.tsx");
        const column = readUi("kanban-column.tsx");
        const card = readUi("draggable-task-card.tsx");

        expect(board).toMatch(/useProjectAccess/);
        expect(board).toMatch(/canEditTasks/);
        expect(board).toMatch(/moveTasksToColumn/);
        expect(column).toMatch(/useProjectAccess/);
        expect(column).toMatch(/canEditTasks/);
        expect(card).toMatch(/disabled:\s*!canDrag|disabled:\s*!canEditTasks/);
        expect(board).toMatch(/isSettled/);
        expect(column).toMatch(/isSettled/);
    });

    it("keeps create-task and manage-column affordances on Role capabilities", () => {
        const addTask = readUi("kanban-add-task.tsx");
        const board = readUi("kanban-board.tsx");
        const column = readUi("kanban-column.tsx");

        expect(addTask).toMatch(/canCreateTasks/);
        expect(addTask).toMatch(/if\s*\(\s*!canCreate\s*\)/);
        expect(board).toMatch(/canManage\s*\?/);
        expect(column).toMatch(/canManage\s*\?/);
        // Column droppables stay enabled so Contributors can drop Tasks onto
        // empty columns; only the drag handle is Role-gated.
        expect(column).not.toMatch(/disabled:\s*!canManageBoard/);
        expect(column).not.toMatch(/disabled:\s*!canManage\b/);
    });
});
