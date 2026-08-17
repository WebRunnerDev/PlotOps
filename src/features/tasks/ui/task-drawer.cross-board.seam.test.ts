import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawer cross-board open seam", () => {
    it("navigates to the Task's Board instead of dropping the selection", () => {
        const drawer = readFileSync(
            path.join(dirname, "task-drawer.tsx"),
            "utf8"
        );

        expect(drawer).toMatch(/resolveCachedTaskBoardId/);
        expect(drawer).toMatch(/selectedIsOnThisBoard/);
        expect(drawer).toMatch(/\/projects\/\$projectId\/boards\/\$boardId/);
        expect(drawer).toMatch(/cachedOtherBoardId/);
    });
});
