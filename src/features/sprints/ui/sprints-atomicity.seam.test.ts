import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("sprint close carryover compensation seam", () => {
    it("deletes orphan new-draft when close fails after create", () => {
        const source = readFileSync(
            path.join(dirname, "sprint-lifecycle-dialogs.tsx"),
            "utf8"
        );

        expect(source).toMatch(/createdDraftId/);
        expect(source).toMatch(/removeDraft\.mutateAsync/);
    });
});

describe("backlog move serialization seam", () => {
    it("gates overlapping backlog moves while a mutation is pending", () => {
        const source = readFileSync(
            path.join(dirname, "backlog-page.tsx"),
            "utf8"
        );

        expect(source).toMatch(/moveTasks\.isPending/);
    });
});
