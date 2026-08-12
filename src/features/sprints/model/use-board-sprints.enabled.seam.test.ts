import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("useBoardSprints enabled seam", () => {
    it("does not fetch sprints when boardId is empty (avoids board_id=eq. 22P02)", () => {
        const source = readFileSync(
            path.join(dirname, "use-sprints.ts"),
            "utf8"
        );
        const function_ = source.slice(
            source.indexOf("export function useBoardSprints"),
            source.indexOf("export function useSprintEvents")
        );

        expect(function_).toMatch(/enabled:\s*Boolean\(\s*boardId\s*\)/);
    });
});
