import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const tasksUi = path.join(dirname, "../../../features/tasks/ui");

function readTasksUi(name: string) {
    return readFileSync(path.join(tasksUi, name), "utf8");
}

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Board skin seam (ADR 0007)", () => {
    it("keeps Make column chrome: accent square, bordered panel, empty craft", () => {
        const column = readUi("kanban-column.tsx");
        const board = readUi("kanban-board.tsx");
        const page = readUi("board-page.tsx");

        expect(column).toMatch(/columnAccentClass/);
        expect(column).toMatch(/border border-border bg-card\/50/);
        expect(column).toMatch(/columns\.empty/);
        expect(column).toMatch(/text-meta/);
        expect(board).toMatch(/gap-1/);
        expect(page).toMatch(/border-primary\/25/);
    });

    it("skins cards and drawer with density + cobalt vocabulary", () => {
        const card = readTasksUi("task-card.tsx");
        const drawer = readTasksUi("task-drawer.tsx");
        const toolbar = readTasksUi("board-task-toolbar.tsx");

        expect(card).toMatch(/rounded-none/);
        expect(card).toMatch(
            /hover:ring-primary\/25|group-hover\/task:ring-primary\/25/
        );
        expect(card).toMatch(/PRIORITY_RAIL_CLASS/);
        expect(drawer).toMatch(/border-primary\/20/);
        expect(drawer).toMatch(/size-1\.5 shrink-0 bg-primary/);
        expect(toolbar).toMatch(/border-primary\/25/);
        expect(toolbar).toMatch(/font-mono text-code/);
    });
});
