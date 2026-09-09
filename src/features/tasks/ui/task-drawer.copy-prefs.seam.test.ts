import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskDrawer copy-all preferences seam", () => {
    it("passes drawer copy prefs into buildTaskCopySections", () => {
        const source = readFileSync(
            path.join(dirname, "task-drawer.tsx"),
            "utf8"
        );

        expect(source).toMatch(/copyIncludeTaskKey/);
        expect(source).toMatch(/copyIncludeTaskType/);
        expect(source).toMatch(/copyMetadataFields/);
        expect(source).toMatch(/includeTaskKey:\s*copyIncludeTaskKey/);
        expect(source).toMatch(/includeTaskType:\s*copyIncludeTaskType/);
        expect(source).toMatch(/taskKey:\s*task\.key/);
        expect(source).toMatch(/metadataSections/);
        expect(source).toMatch(/copyMetadataFields\.status/);
        expect(source).toMatch(/copyMetadataFields\.assignee/);
        expect(source).toMatch(/copyMetadataFields\.sprint/);
        expect(source).toMatch(/copyMetadataFields\.subtasks/);
        expect(source).toMatch(/copyMetadataFields\.relatedTasks/);
        expect(source).toMatch(/formatTaskCopySubtaskLines/);
        expect(source).toMatch(/formatTaskCopyRelatedTaskLines/);
    });
});
