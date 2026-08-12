import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("board multi-select archive seams", () => {
    it("wires selection store, bar, and card checkbox stopPropagation", () => {
        const board = fs.readFileSync(
            path.join(dirname, "kanban-board.tsx"),
            "utf8"
        );
        const card = fs.readFileSync(
            path.join(dirname, "draggable-task-card.tsx"),
            "utf8"
        );
        const column = fs.readFileSync(
            path.join(dirname, "kanban-column.tsx"),
            "utf8"
        );

        const taskCard = fs.readFileSync(
            path.join(dirname, "../../../features/tasks/ui/task-card.tsx"),
            "utf8"
        );

        expect(board).toMatch(/BoardTaskSelectionBar/);

        const selectionBar = fs.readFileSync(
            path.join(
                dirname,
                "../../../features/tasks/ui/board-task-selection-bar.tsx"
            ),
            "utf8"
        );
        expect(selectionBar).toMatch(/createPortal/);
        expect(selectionBar).toMatch(/fixed inset-x-0 bottom-3/);
        expect(selectionBar).not.toMatch(/w-\[100cqw\]/);

        expect(board).toMatch(/syncBoardSelection/);
        expect(board).toMatch(/Escape/);
        expect(board).toMatch(/moveTasksToColumn/);
        expect(board).toMatch(/resolveCrossColumnDragTaskIds/);
        expect(board).toMatch(/BoardMouseSensor/);
        expect(board).toMatch(/BoardTouchSensor/);
        expect(card).toMatch(/gateDragListeners/);
        expect(card).toMatch(/toggleTask/);
        expect(card).toMatch(/selection=\{/);
        expect(taskCard).toMatch(/Checkbox/);
        expect(taskCard).toMatch(/stopPropagation/);
        expect(taskCard).toMatch(/data-no-dnd/);
        expect(taskCard).toMatch(/group-hover\/task/);
        expect(column).toMatch(/selectionEnabled=\{canSelectForArchive\}/);
        expect(column).toMatch(/boardId=\{boardId\}/);
    });
});
