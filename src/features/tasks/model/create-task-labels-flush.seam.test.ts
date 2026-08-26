import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("createTask labels flush seam", () => {
    it("optimistically caches labelIds then flushes via updateTaskDetails", () => {
        const source = readFileSync(
            path.join(dirname, "use-board-tasks.ts"),
            "utf8"
        );

        expect(source).toMatch(/labelIds\s*&&\s*labelIds\.length\s*>\s*0/);
        expect(source).toMatch(/labelIds:\s*\[\.\.\.labelIds\]/);
        expect(source).toMatch(
            /updateTaskDetails\(withLabels\.id,\s*\{\},\s*labelIds\)/
        );
        expect(source).toMatch(/tasks\.labelsApplyFailed/);
    });
});
