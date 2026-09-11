import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const uiDirectory = path.dirname(fileURLToPath(import.meta.url));

describe("BoardSprintControls multi-Active Start seam", () => {
    it("keeps Start available when the Board already has an Active Sprint", () => {
        const source = readFileSync(
            path.join(uiDirectory, "board-sprint-controls.tsx"),
            "utf8"
        );

        expect(source).toMatch(
            /showStart\s*=\s*canManage\s*&&\s*Boolean\(startCandidate\)/
        );
        expect(source).not.toMatch(/showStart\s*=\s*canManage\s*&&\s*!active/);
    });
});
