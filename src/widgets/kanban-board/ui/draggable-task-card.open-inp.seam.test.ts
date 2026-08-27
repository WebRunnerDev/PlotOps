import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("DraggableTaskCard open INP seams", () => {
    it("opens the task drawer via startTransition so the click handler stays short", () => {
        const card = readFileSync(
            path.join(dirname, "draggable-task-card.tsx"),
            "utf8"
        );

        expect(card).toMatch(/startTransition/);
        expect(card).toMatch(
            /startTransition\(\(\)\s*=>\s*\{[\s\S]*selectTask\(task\.id\)/
        );
    });
});
