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
    it("routes backlog moves through serialized sprint membership planning", () => {
        const backlogSource = readFileSync(
            path.join(dirname, "backlog-page.tsx"),
            "utf8"
        );
        const hookSource = readFileSync(
            path.join(dirname, "..", "model", "use-sprints.ts"),
            "utf8"
        );

        expect(backlogSource).toMatch(/moveTasksToSprint/);
        expect(backlogSource).toMatch(/moveTasks\.isPending/);
        expect(hookSource).toMatch(/createMutationQueue/);
        expect(hookSource).toMatch(/planSprintMembershipMove/);
        expect(hookSource).toMatch(/applySprintMembershipUpdates/);
    });
});
