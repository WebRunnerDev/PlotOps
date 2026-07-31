import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi() {
    return readFileSync(
        path.join(dirname, "project-labels-settings.tsx"),
        "utf8"
    );
}

describe("ProjectLabelsSettings tagged-tasks usage guards", () => {
    it("fails closed on tagged-tasks loading and error before delete/move", () => {
        const source = readUi();

        expect(source).toMatch(/isError:\s*taggedTasksError/);
        expect(source).toMatch(/isLoading:\s*taggedTasksLoading/);
        expect(source).toMatch(/usageKnown/);
        expect(source).toMatch(/disabled=\{!usageKnown\}/);
        expect(source).toMatch(
            /disabled=\{otherProjects\.length === 0 \|\| !usageKnown\}/
        );
        expect(source).toMatch(/labelSettings\.usageLoadFailed/);
        expect(source).toMatch(
            /if\s*\(\s*!usageKnown\s*\|\|\s*hasArchivedUsage/
        );
        expect(source).toMatch(/labelSettings\.transferWithTasks/);
        expect(source).toMatch(/labelSettings\.transferDuplicate/);
    });
});
