import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("DraggableTaskCard open INP seams", () => {
    it("opens the task drawer synchronously so snap-point animation is not deferred", () => {
        const card = readFileSync(
            path.join(dirname, "draggable-task-card.tsx"),
            "utf8"
        );

        expect(card).toMatch(/onDoubleClick=\{handleCardDoubleClick\}/);
        expect(card).toMatch(/openTaskDrawer/);
        expect(card).toMatch(/selectTask\(task\.id\)/);
        expect(card).not.toMatch(/startTransition/);
    });
});
