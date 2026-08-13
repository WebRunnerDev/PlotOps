import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("kanban board DnD persist seams", () => {
    it("previews on drag over and persists once on drag end", () => {
        const source = readUi("kanban-board.tsx");

        expect(source).toMatch(/persist:\s*false/);
        expect(source).toMatch(/commitTaskDragGesture/);
        expect(source).toMatch(/rollbackColumnDragGesture/);
        expect(source).toMatch(/rollbackTaskDragGesture/);
        expect(source).toMatch(/reorderTaskWithin/);
        expect(source).toMatch(/visibleColumnTaskIds/);
        expect(source).toMatch(/isBoardTaskViewRestricted/);
        expect(source).toMatch(/displayedTaskIds/);
        expect(source).toMatch(/moveTasksToColumn/);
        expect(source).toMatch(/BoardMouseSensor/);
        expect(source).toMatch(/BoardTouchSensor/);
        expect(source).toMatch(/resolveBoardMouseActivation/);
        expect(source).toMatch(/resolveBoardTouchActivation/);
        expect(source).toMatch(/boardCollisionDetection/);
        expect(source).toMatch(/horizontalListSortingStrategy/);
    });

    it("does not live-reorder columns on dragOver", () => {
        const source = readUi("kanban-board.tsx");
        const dragOverHandler = source.match(
            /const handleDragOver = \([\s\S]*?\n {4}\};/
        )?.[0];

        expect(dragOverHandler).toBeDefined();
        // Column gap preview is strategy-only; live reorder thrashes collision.
        expect(dragOverHandler).toMatch(
            /if \(activeType === "column"\) return;/
        );
        expect(dragOverHandler).not.toMatch(/reorderColumns/);
    });

    it("persists column order once on drag end", () => {
        const source = readUi("kanban-board.tsx");
        const dragEndHandler = source.match(
            /const handleDragEnd = \([\s\S]*?\n {4}\};/
        )?.[0];

        expect(dragEndHandler).toBeDefined();
        expect(dragEndHandler).toMatch(
            /if \(activeType === "column"\) \{[\s\S]*?reorderColumns\([\s\S]*?persist:\s*true/
        );
        expect(dragEndHandler).not.toMatch(/commitColumnDragGesture/);
    });
});
