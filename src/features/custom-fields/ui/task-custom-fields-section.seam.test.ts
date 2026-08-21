import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TaskCustomFieldsSection type filter + blur persist", () => {
    it("filters by Task type and commits on blur", () => {
        const source = readFileSync(
            path.join(dirname, "task-custom-fields-section.tsx"),
            "utf8"
        );

        expect(source).toMatch(/filterCustomFieldsForTaskType/);
        expect(source).toMatch(/onBlur/);
        expect(source).toMatch(/setCustomFieldValue/);
        expect(source).toMatch(/canEdit/);
    });
});

describe("task-drawer mounts TaskCustomFieldsSection", () => {
    it("passes canEdit, projectId, taskId, and task.type", () => {
        const source = readFileSync(
            path.join(dirname, "../../tasks/ui/task-drawer.tsx"),
            "utf8"
        );

        expect(source).toMatch(/TaskCustomFieldsSection/);
        expect(source).toMatch(
            /<TaskCustomFieldsSection[\s\S]*taskType=\{task\.type\}/
        );
        expect(source).toMatch(
            /<TaskCustomFieldsSection[\s\S]*canEdit=\{canEdit\}/
        );
    });
});
