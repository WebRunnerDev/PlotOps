import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("board archive dialog selection sync", () => {
    it("does not reset selection to a fresh Set on every closed render", () => {
        const source = readFileSync(
            path.join(dirname, "board-archive-dialog.tsx"),
            "utf8"
        );

        // `data: archived = []` + setSelectedIds(new Set()) while closed caused
        // Maximum update depth on the board (unstable empty array → effect loop).
        expect(source).toMatch(/EMPTY_ARCHIVED/);
        expect(source).toMatch(/EMPTY_ARCHIVED_IDS/);
        expect(source).toMatch(
            /setSelectedIds\(\(current\) =>\s*current\.size === 0 \? current : new Set\(\)/
        );
        expect(source).not.toMatch(/data:\s*archived\s*=\s*\[\]/);
        expect(source).not.toMatch(
            /if\s*\(!open\)\s*\{\s*setSelectedIds\(new Set\(\)\)/
        );
    });
});
