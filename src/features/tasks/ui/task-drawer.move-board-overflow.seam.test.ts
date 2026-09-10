import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawer move-to-board dialog overflow seam", () => {
    it("keeps long unbroken board names from expanding the dialog", () => {
        const source = readFileSync(
            path.join(dirname, "task-drawer.tsx"),
            "utf8"
        );

        const moveDialog = source.slice(
            source.indexOf("open={moveTarget !== null}"),
            source.indexOf("const DEADLINE_START_MONTH")
        );

        expect(moveDialog).toMatch(
            /AlertDialogContent[\s\S]*?className="[^"]*min-w-0[^"]*"/
        );
        expect(moveDialog).toMatch(
            /AlertDialogTitle[\s\S]*?className="[^"]*wrap-anywhere[^"]*"/
        );
        expect(moveDialog).toMatch(
            /id="move-task-column"[\s\S]*?<span className="min-w-0 flex-1 truncate">/
        );
        expect(moveDialog).toMatch(
            /id="move-task-sprint"[\s\S]*?<span className="min-w-0 flex-1 truncate">/
        );
        expect(moveDialog).toMatch(/boards\.moveToSprint/);
    });
});
