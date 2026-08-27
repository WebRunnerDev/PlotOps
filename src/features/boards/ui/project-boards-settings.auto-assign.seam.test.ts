import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("ProjectBoardsSettings auto-assign seam", () => {
    it("edits and saves boards.auto_assign_to_creator for a solo Team", () => {
        const source = readFileSync(
            path.join(dirname, "project-boards-settings.tsx"),
            "utf8"
        );

        expect(source).toMatch(/initialAutoAssignToCreator/);
        expect(source).toMatch(/auto_assign_to_creator/);
        expect(source).toMatch(/autoAssignToCreator/);
        expect(source).toMatch(/showAutoAssignToCreator/);
    });
});
