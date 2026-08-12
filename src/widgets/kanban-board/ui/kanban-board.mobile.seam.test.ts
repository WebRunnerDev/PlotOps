import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const uiDirectory = path.dirname(fileURLToPath(import.meta.url));
const modelDirectory = path.join(uiDirectory, "../model");
const tasksUiDirectory = path.join(uiDirectory, "../../../features/tasks/ui");

function readUi(name: string) {
    return readFileSync(path.join(uiDirectory, name), "utf8");
}

describe("KanbanBoard mobile seam", () => {
    it("splits mouse distance drag from touch long-press activation", () => {
        const board = readUi("kanban-board.tsx");
        const sensors = readFileSync(
            path.join(modelDirectory, "board-pointer-sensor.ts"),
            "utf8"
        );
        const activation = readFileSync(
            path.join(modelDirectory, "resolve-board-drag-activation.ts"),
            "utf8"
        );

        expect(sensors).toMatch(/BoardMouseSensor/);
        expect(sensors).toMatch(/BoardTouchSensor/);
        expect(board).toMatch(/BoardMouseSensor/);
        expect(board).toMatch(/BoardTouchSensor/);
        expect(board).toMatch(/resolveBoardMouseActivation/);
        expect(board).toMatch(/resolveBoardTouchActivation/);
        expect(activation).toMatch(/delay:\s*250/);
        expect(activation).toMatch(/tolerance:\s*8/);
        expect(activation).toMatch(/distance:\s*6/);
    });

    it("keeps board chrome and columns usable at 375px without fixed desktop padding", () => {
        const page = readUi("board-page.tsx");
        const board = readUi("kanban-board.tsx");
        const column = readUi("kanban-column.tsx");
        const addTask = readUi("kanban-add-task.tsx");

        expect(page).toMatch(/overflow-x-auto/);
        expect(page).toMatch(/px-3\b/);
        expect(page).toMatch(/sm:px-12/);
        expect(page).toMatch(/min-h-9/);
        expect(board).toMatch(
            /w-\[calc\(100cqw-1\.5rem\)\].*sm:w-\[calc\(100cqw-6rem\)\]|sm:w-\[calc\(100cqw-6rem\)\].*w-\[calc\(100cqw-1\.5rem\)\]/
        );
        expect(column).toMatch(/min-w-72/);
        expect(column).toMatch(/overflow-y-auto/);
        expect(addTask).toMatch(/h-9.*sm:h-8|sm:h-8.*h-9/);
    });

    it("does not lock card touch-action so long-press can coexist with scroll", () => {
        const card = readUi("draggable-task-card.tsx");
        expect(card).not.toMatch(/touch-none/);
    });
});

describe("TaskCard mobile seam", () => {
    it("expands selection checkbox hit target for touch", () => {
        const source = readFileSync(
            path.join(tasksUiDirectory, "task-card.tsx"),
            "utf8"
        );

        expect(source).toMatch(/-inset-3|min-h-11|min-w-11|size-11/);
        expect(source).toMatch(/data-no-dnd/);
    });
});
