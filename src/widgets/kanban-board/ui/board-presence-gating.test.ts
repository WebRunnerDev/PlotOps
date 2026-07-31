import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Board page presence seam", () => {
    it("gates KanbanBoard on resolveBoardPagePresence ready state", () => {
        const page = readUi("board-page.tsx");

        expect(page).toMatch(/resolveBoardPagePresence/);
        expect(page).toMatch(/boards-loading|boardsLoading/);
        expect(page).toMatch(/board-not-found|boardNotFound/);
        expect(page).toMatch(/presence\.kind\s*===\s*"ready"|currentBoard/);
        expect(page).toMatch(/<KanbanBoard/);
    });
});

describe("Task card keyboard open seam", () => {
    it("exposes a keyboard-activatable open control", () => {
        const card = readUi("draggable-task-card.tsx");

        expect(card).toMatch(/shouldOpenTaskFromKeyboard/);
        expect(card).toMatch(/role=["']button["']/);
        expect(card).toMatch(/tabIndex=\{0\}/);
        expect(card).toMatch(/onKeyDown/);
        expect(card).toMatch(/focus-visible:ring-2/);
    });
});
