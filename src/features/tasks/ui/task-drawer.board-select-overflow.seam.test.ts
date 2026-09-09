import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawer board select overflow seam", () => {
    it("truncates long board names inside the field grid", () => {
        const source = readFileSync(
            path.join(dirname, "task-drawer.tsx"),
            "utf8"
        );

        expect(source).toMatch(
            /FIELD_CONTROL_CLASS\s*=\s*"[^"]*min-w-0[^"]*overflow-hidden[^"]*"/
        );
        expect(source).toMatch(
            /className="flex min-w-0 flex-col gap-1\.5"[\s\S]*?htmlFor="task-board"[\s\S]*?id="task-board"[\s\S]*?<span className="min-w-0 flex-1 truncate">/
        );
    });
});
