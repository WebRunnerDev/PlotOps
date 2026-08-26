import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const widgetsDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../widgets/kanban-board/ui"
);
const backlogDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../sprints/ui"
);
const palettePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../command-palette/ui/command-palette.tsx"
);

describe("quick-add composer seams", () => {
    it("wires TaskQuickAddChips into kanban and backlog composers", () => {
        const kanban = readFileSync(
            path.join(widgetsDirectory, "kanban-add-task.tsx"),
            "utf8"
        );
        const backlog = readFileSync(
            path.join(backlogDirectory, "backlog-add-task.tsx"),
            "utf8"
        );

        expect(kanban).toMatch(/TaskQuickAddChips/);
        expect(kanban).toMatch(/chipMenuOpen/);
        expect(kanban).toMatch(/labelIds:\s*fields\.labelIds/);
        expect(backlog).toMatch(/TaskQuickAddChips/);
        expect(backlog).toMatch(/labelIds:\s*fields\.labelIds/);
    });

    it("keeps Cmd+K create without quick-add chips", () => {
        const palette = readFileSync(palettePath, "utf8");

        expect(palette).not.toMatch(/TaskQuickAddChips/);
    });
});
